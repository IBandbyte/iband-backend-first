// comments.js (ESM)
// Public Comments Router (READ-ONLY, safe)
// Mounted at: /api/comments
//
// Canonical endpoint:
//   GET /api/comments?artistId=:id&page=1&limit=50
//
// Rules:
// - Only returns APPROVED comments
// - Never exposes flags/moderation fields beyond what is safe
// - Store-adapter pattern so it won't break if commentsStore API changes

import express from "express";
import commentsStore from "./commentsStore.js";

const router = express.Router();

/* -------------------- Helpers -------------------- */

const nowIso = () => new Date().toISOString();
const safeText = (v) => (v === null || v === undefined ? "" : String(v)).trim();

const toInt = (v, fallback = 0) => {
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
};

function publicSanitizeComment(c) {
  // Public-safe shape (no admin/mod fields other than what’s harmless)
  return {
    id: safeText(c?.id),
    artistId: safeText(c?.artistId),
    author: safeText(c?.author),
    text: safeText(c?.text),
    status: safeText(c?.status), // optional: keep for debugging; can remove later
    createdAt: safeText(c?.createdAt),
    updatedAt: safeText(c?.updatedAt),
  };
}

/* -------------------- Store Adapter (future-proof) -------------------- */
/**
 * Preferred store functions (if present):
 * - commentsStore.listPublic({ artistId, status, page, limit })
 * - commentsStore.listAdmin({ status, artistId, flagged })
 * - commentsStore.listAll() / getAll()
 */
const store = {
  listApprovedByArtist({ artistId } = {}) {
    const aId = safeText(artistId);
    if (!aId) return [];

    // Best: purpose-built public list
    if (typeof commentsStore.listPublic === "function") {
      const r = commentsStore.listPublic({ artistId: aId, status: "approved" });
      if (Array.isArray(r)) return r;
      if (Array.isArray(r?.comments)) return r.comments;
      return [];
    }

    // Next best: admin list with filters
    if (typeof commentsStore.listAdmin === "function") {
      const r = commentsStore.listAdmin({ artistId: aId, status: "approved" });
      if (Array.isArray(r)) return r;
      if (Array.isArray(r?.comments)) return r.comments;
      return [];
    }

    // Fallback: list all then filter
    const listAllFn =
      typeof commentsStore.listAll === "function"
        ? commentsStore.listAll.bind(commentsStore)
        : typeof commentsStore.getAll === "function"
        ? commentsStore.getAll.bind(commentsStore)
        : null;

    const rows = listAllFn ? listAllFn() : [];
    return Array.isArray(rows)
      ? rows.filter(
          (c) =>
            safeText(c?.artistId) === aId &&
            safeText(c?.status).toLowerCase() === "approved"
        )
      : [];
  },

  meta() {
    // Optional: expose storage meta if store provides it (won’t error if missing)
    const storage = commentsStore?.storage ? commentsStore.storage : undefined;
    return storage ? { storage } : {};
  },
};

/* -------------------- Routes -------------------- */

// GET /api/comments/health
router.get("/health", (_req, res) => {
  return res.json({
    success: true,
    message: "comments ok",
    ts: nowIso(),
    ...store.meta(),
  });
});

/**
 * GET /api/comments?artistId=:id&page=1&limit=50
 * Public read-only comments for a given artist.
 * Returns only APPROVED comments.
 */
router.get("/", (req, res) => {
  const artistId = safeText(req.query?.artistId);
  if (!artistId) {
    return res.status(400).json({
      success: false,
      message: "artistId is required.",
    });
  }

  const page = Math.max(1, toInt(req.query?.page, 1));
  const limit = Math.min(100, Math.max(1, toInt(req.query?.limit, 50)));

  const all = store.listApprovedByArtist({ artistId });

  // newest first
  const sorted = (Array.isArray(all) ? all : [])
    .slice()
    .sort((a, b) => {
      const at = Date.parse(a?.createdAt || a?.updatedAt || "") || 0;
      const bt = Date.parse(b?.createdAt || b?.updatedAt || "") || 0;
      return bt - at;
    });

  const total = sorted.length;
  const start = (page - 1) * limit;

  const paged = sorted
    .slice(start, start + limit)
    .map(publicSanitizeComment);

  return res.json({
    success: true,
    artistId,
    page,
    limit,
    total,
    count: paged.length,
    comments: paged,
  });
});

export default router;