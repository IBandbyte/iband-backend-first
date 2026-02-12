// comments.js (ESM)
// iBand Backend — Public Comments Router (READ-only for Step A1)
// Mounted at: /api/comments
//
// Step A1 goals:
// - Public READ endpoint for comments by artist
// - Only returns APPROVED comments (no flags, no moderation metadata requirements)
// - Consistent JSON responses
// - Store-adapter future-proofing (won’t break if commentsStore method names change)
//
// Endpoints:
// - GET /api/comments/health
// - GET /api/comments?artistId=...   (approved only)
// - GET /api/comments/:id           (approved only; safe detail)

import express from "express";
import commentsStore from "./commentsStore.js";

const router = express.Router();

/* -------------------- Helpers -------------------- */

const nowIso = () => new Date().toISOString();
const safeText = (v) => (v === null || v === undefined ? "" : String(v)).trim();

const toBool = (v) => String(v ?? "").toLowerCase() === "true";

function jsonFail(res, status, message, extra = {}) {
  return res.status(status).json({ success: false, message, ...extra });
}

/* -------------------- Store Adapter (future-proof) -------------------- */
/**
 * Prefer a dedicated public method if it exists:
 * - commentsStore.listPublic({ artistId, status, flagged, limit, offset })
 *
 * Otherwise fallback:
 * - commentsStore.listAll() / getAll() -> filter in router
 * - commentsStore.getById(id) / get(id)
 */
const store = {
  listAll() {
    if (typeof commentsStore.listAll === "function") return commentsStore.listAll();
    if (typeof commentsStore.getAll === "function") return commentsStore.getAll();
    // If store only supports admin listing, we still try it (best-effort)
    if (typeof commentsStore.listAdmin === "function") {
      const r = commentsStore.listAdmin({});
      return r?.comments ?? [];
    }
    return [];
  },

  listPublic({ artistId, limit = 50, offset = 0 } = {}) {
    // Preferred
    if (typeof commentsStore.listPublic === "function") {
      return commentsStore.listPublic({
        artistId,
        status: "approved",
        flagged: false,
        limit,
        offset,
      });
    }

    // Fallback
    const rows = this.listAll();
    const filtered = rows
      .filter((c) => safeText(c?.artistId) === safeText(artistId))
      .filter((c) => safeText(c?.status).toLowerCase() === "approved")
      .sort((a, b) => new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0));

    return {
      ok: true,
      count: filtered.length,
      comments: filtered.slice(offset, offset + limit),
    };
  },

  getById(id) {
    if (typeof commentsStore.getById === "function") return commentsStore.getById(id);
    if (typeof commentsStore.get === "function") return commentsStore.get(id);
    return null;
  },
};

/* -------------------- Public sanitize -------------------- */

function publicSanitizeComment(c) {
  // Keep only fields safe for public viewing
  return {
    id: safeText(c?.id),
    artistId: safeText(c?.artistId),
    author: safeText(c?.author),
    text: safeText(c?.text),
    status: safeText(c?.status), // will only ever be "approved" in public responses
    createdAt: safeText(c?.createdAt),
    updatedAt: safeText(c?.updatedAt),
  };
}

/* -------------------- Routes -------------------- */

// GET /api/comments/health
router.get("/health", (_req, res) => {
  return res.json({
    success: true,
    message: "comments ok",
    ts: nowIso(),
  });
});

/**
 * GET /api/comments?artistId=demo
 * Public list — APPROVED only.
 *
 * Query:
 * - artistId (required)
 * - limit (optional, default 50, max 100)
 * - offset (optional, default 0)
 *
 * NOTE: No "flagged" or status controls on public route.
 */
router.get("/", (req, res) => {
  const artistId = safeText(req.query?.artistId);
  if (!artistId) {
    return jsonFail(res, 400, "Validation error: 'artistId' is required.");
  }

  const limitRaw = Number(req.query?.limit);
  const offsetRaw = Number(req.query?.offset);

  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 50;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;

  // Hard safety: ignore attempts to leak admin filters
  const _ignoredFlagged = toBool(req.query?.flagged);
  const _ignoredStatus = safeText(req.query?.status);

  const result = store.listPublic({ artistId, limit, offset });

  if (!result || result.ok === false) {
    return jsonFail(res, result?.status || 500, result?.message || "Failed to list comments.");
  }

  const list = Array.isArray(result.comments) ? result.comments : [];
  const sanitized = list.map(publicSanitizeComment);

  return res.status(200).json({
    success: true,
    count: sanitized.length,
    comments: sanitized,
    artistId,
    limit,
    offset,
  });
});

/**
 * GET /api/comments/:id
 * Public detail — APPROVED only.
 * If comment exists but is not approved -> 404 (no leakage).
 */
router.get("/:id", (req, res) => {
  const id = safeText(req.params?.id);
  if (!id) return jsonFail(res, 400, "Comment id is required.");

  const c = store.getById(id);
  if (!c) return jsonFail(res, 404, "Comment not found.");

  const status = safeText(c?.status).toLowerCase();
  if (status !== "approved") {
    return jsonFail(res, 404, "Comment not found.");
  }

  return res.status(200).json({
    success: true,
    comment: publicSanitizeComment(c),
  });
});

export default router;