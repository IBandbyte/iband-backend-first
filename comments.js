// comments.js (ESM)
// Public Comments Router
//
// Mounted at: /api/comments
//
// Public rules (safety-first):
// - Public GET returns ONLY approved comments
// - Public POST always creates PENDING comments (must be moderated via /api/admin/comments)
// - Lightweight rate limiting to reduce spam (IP-based, dependency-free)
// - Store adapter so this router survives store API changes
//
// Endpoints:
// - GET  /api/comments/health
// - GET  /api/comments?artistId=&limit=&offset=
// - GET  /api/comments/:id                 (approved only)
// - POST /api/comments                      (creates pending)
//
// Body (POST):
// { artistId, author, text }

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

function jsonFail(res, status, message, extra = {}) {
  return res.status(status).json({ success: false, message, ...extra });
}

/* -------------------- Rate limit (dependency-free) -------------------- */
/**
 * Simple IP-based limiter:
 * - max 5 creates per 60 seconds per IP
 * - plus a 10s cooldown between creates
 *
 * NOTE: Trust proxy is enabled in server.js, so req.ip should be correct on Render.
 */
const RL_WINDOW_MS = 60_000;
const RL_MAX_IN_WINDOW = 5;
const RL_COOLDOWN_MS = 10_000;

const rateState = new Map(); // key(ip) -> { ts: number[], lastAt: number }

function rateKey(req) {
  // Prefer userId if you later add auth; for now use IP
  const ip = safeText(req.ip || req.headers["x-forwarded-for"] || "unknown");
  return ip || "unknown";
}

function rateLimitCheck(req) {
  const key = rateKey(req);
  const now = Date.now();

  const state = rateState.get(key) || { ts: [], lastAt: 0 };

  // cooldown
  if (state.lastAt && now - state.lastAt < RL_COOLDOWN_MS) {
    return {
      ok: false,
      reason: "cooldown",
      retryAfterSec: Math.ceil((RL_COOLDOWN_MS - (now - state.lastAt)) / 1000),
      key,
    };
  }

  // window prune
  state.ts = state.ts.filter((t) => now - t <= RL_WINDOW_MS);

  if (state.ts.length >= RL_MAX_IN_WINDOW) {
    const oldest = state.ts[0] || now;
    const retryAfterSec = Math.ceil((RL_WINDOW_MS - (now - oldest)) / 1000);
    return { ok: false, reason: "window", retryAfterSec, key };
  }

  // accept
  state.ts.push(now);
  state.lastAt = now;
  rateState.set(key, state);

  return { ok: true, key };
}

/* -------------------- Store adapter (future-proof) -------------------- */
/**
 * We standardize store calls so we don’t break if commentsStore changes.
 * Your adminComments.js already uses an adapter pattern — we match it here.
 */
const store = {
  listPublic({ artistId, limit = 50, offset = 0 } = {}) {
    // Preferred
    if (typeof commentsStore.listPublic === "function") {
      return commentsStore.listPublic({ artistId, limit, offset });
    }

    // Fallback: listAll/getAll then filter approved
    const listAllFn =
      typeof commentsStore.listAll === "function"
        ? commentsStore.listAll.bind(commentsStore)
        : typeof commentsStore.getAll === "function"
        ? commentsStore.getAll.bind(commentsStore)
        : null;

    const rows = listAllFn ? listAllFn() : [];
    let filtered = Array.isArray(rows) ? rows : [];

    if (artistId) filtered = filtered.filter((c) => safeText(c.artistId) === safeText(artistId));

    // public: only approved
    filtered = filtered.filter((c) => safeText(c.status).toLowerCase() === "approved");

    // newest first
    filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const start = Math.max(0, offset);
    const end = start + Math.max(1, limit);
    const sliced = filtered.slice(start, end);

    return { ok: true, count: sliced.length, comments: sliced };
  },

  getPublicById(id) {
    // Preferred
    if (typeof commentsStore.getPublicById === "function") return commentsStore.getPublicById(id);

    // Fallback: getById/get then enforce approved
    const getFn =
      typeof commentsStore.getById === "function"
        ? commentsStore.getById.bind(commentsStore)
        : typeof commentsStore.get === "function"
        ? commentsStore.get.bind(commentsStore)
        : null;

    const c = getFn ? getFn(id) : null;
    if (!c) return null;
    if (safeText(c.status).toLowerCase() !== "approved") return null;
    return c;
  },

  createPublic({ artistId, author, text }) {
    // Preferred
    if (typeof commentsStore.createPublic === "function") {
      return commentsStore.createPublic({ artistId, author, text });
    }

    // Fallback: create() but we enforce pending-by-default for public
    if (typeof commentsStore.create === "function") {
      return commentsStore.create({ artistId, author, text, status: "pending", source: "public" });
    }

    return { ok: false, status: 500, message: "commentsStore.create/createPublic is not implemented." };
  },
};

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
 * GET /api/comments?artistId=&limit=&offset=
 * Public list — approved only.
 */
router.get("/", (req, res) => {
  const artistId = safeText(req.query?.artistId);
  const limit = Math.min(100, Math.max(1, toInt(req.query?.limit, 50)));
  const offset = Math.max(0, toInt(req.query?.offset, 0));

  const result = store.listPublic({ artistId: artistId || undefined, limit, offset });

  if (!result || result.ok === false) {
    return jsonFail(res, result?.status || 500, result?.message || "Failed to list comments.");
  }

  // keep response shape consistent with what you already tested
  return res.status(200).json({
    success: true,
    count: result.count ?? (Array.isArray(result.comments) ? result.comments.length : 0),
    comments: result.comments ?? [],
    artistId: artistId || undefined,
    limit,
    offset,
  });
});

/**
 * GET /api/comments/:id
 * Public read — approved only.
 */
router.get("/:id", (req, res) => {
  const id = safeText(req.params?.id);
  if (!id) return jsonFail(res, 400, "Comment id is required.");

  const comment = store.getPublicById(id);

  if (!comment) {
    return jsonFail(res, 404, "Comment not found.");
  }

  return res.status(200).json({ success: true, comment });
});

/**
 * POST /api/comments
 * Public create — ALWAYS pending (moderation required).
 */
router.post("/", (req, res) => {
  // rate limit first
  const rl = rateLimitCheck(req);
  if (!rl.ok) {
    res.setHeader("Retry-After", String(rl.retryAfterSec || 10));
    return res.status(429).json({
      success: false,
      message: "Rate limit exceeded. Please try again shortly.",
      reason: rl.reason,
      retryAfterSec: rl.retryAfterSec || 10,
    });
  }

  const artistId = safeText(req.body?.artistId);
  const author = safeText(req.body?.author);
  const text = safeText(req.body?.text);

  // validation (safe + UI-friendly)
  if (!artistId) return jsonFail(res, 400, "Validation error: 'artistId' is required.");
  if (!author) return jsonFail(res, 400, "Validation error: 'author' is required.");
  if (!text) return jsonFail(res, 400, "Validation error: 'text' is required.");

  if (author.length > 60) {
    return jsonFail(res, 400, "Validation error: 'author' must be 60 characters or less.");
  }
  if (text.length > 500) {
    return jsonFail(res, 400, "Validation error: 'text' must be 500 characters or less.");
  }

  const created = store.createPublic({ artistId, author, text });

  if (created?.ok === false) {
    return jsonFail(res, created.status || 400, created.message || "Could not create comment.");
  }

  const comment = created?.comment ? created.comment : created;

  return res.status(201).json({
    success: true,
    message: "Comment submitted successfully (pending moderation).",
    comment,
  });
});

export default router;