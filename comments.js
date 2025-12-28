// comments.js
// Phase 2.2.1 - Comments API (live fan interaction)

import express from "express";
import { commentsStore } from "./commentsStore.js";

export const commentsRouter = express.Router();

function toNumber(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function ok(res, data, extra = {}) {
  return res.status(200).json({ success: true, data, ...extra });
}

function created(res, data, extra = {}) {
  return res.status(201).json({ success: true, data, ...extra });
}

function fail(res, status, message, extra = {}) {
  return res.status(status).json({ success: false, error: message, ...extra });
}

/**
 * GET /comments?artistId=demo&limit=50&page=1
 * Returns newest-first (store inserts newest first)
 */
commentsRouter.get("/comments", (req, res) => {
  try {
    const artistId = String(req.query.artistId ?? "").trim();
    if (!artistId) {
      // In Phase 2.2.1 we only support artist scoped list for frontend.
      return ok(res, { items: [], total: 0, page: 1, limit: 50 }, { note: "artistId required" });
    }

    const limit = toNumber(req.query.limit, 50);
    const page = toNumber(req.query.page, 1);

    const result = commentsStore.listByArtistId(artistId, { limit, page });

    return ok(res, {
      artistId,
      items: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Failed to list comments");
  }
});

/**
 * POST /comments
 * Body: { artistId, name, text }
 */
commentsRouter.post("/comments", (req, res) => {
  try {
    const { artistId, name, text } = req.body || {};
    const comment = commentsStore.add({ artistId, name, text });
    return created(res, comment);
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Failed to add comment");
  }
});

/**
 * Convenience aliases (nice for future UI)
 * GET  /artists/:id/comments
 * POST /artists/:id/comments  { name, text }
 */
commentsRouter.get("/artists/:id/comments", (req, res) => {
  try {
    const artistId = String(req.params.id ?? "").trim();
    const limit = toNumber(req.query.limit, 50);
    const page = toNumber(req.query.page, 1);

    const result = commentsStore.listByArtistId(artistId, { limit, page });

    return ok(res, {
      artistId,
      items: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Failed to list comments");
  }
});

commentsRouter.post("/artists/:id/comments", (req, res) => {
  try {
    const artistId = String(req.params.id ?? "").trim();
    const { name, text } = req.body || {};
    const comment = commentsStore.add({ artistId, name, text });
    return created(res, comment);
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Failed to add comment");
  }
});

/**
 * DELETE /comments/:id
 * (No auth yet — admin phase will add protection.)
 */
commentsRouter.delete("/comments/:id", (req, res) => {
  try {
    const removed = commentsStore.remove(req.params.id);
    if (!removed) return fail(res, 404, "Comment not found");
    return ok(res, removed);
  } catch (e) {
    return fail(res, e.status || 500, e.message || "Failed to delete comment");
  }
});