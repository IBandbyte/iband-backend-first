/**
 * comments.js (ESM)
 * Phase 2.2.A — Artist Comments + Admin Moderation
 *
 * Public:
 * - GET  /comments?artistId=:id
 * - POST /comments  { artistId, name, text }
 * - GET  /artists/:id/comments
 *
 * Admin (requires x-admin-key only if ADMIN_KEY is set):
 * - DELETE /admin/comments/:id
 * - DELETE /api/admin/comments/:id
 */

import express from "express";
import * as commentsStore from "./commentsStore.js";
import * as artistsStore from "./artistsStore.js";

export const commentsRouter = express.Router();

// ----------------------
// Helpers
// ----------------------
function safeText(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeName(v) {
  const s = safeText(v).trim();
  if (!s) return "Anonymous";
  return s.length > 80 ? s.slice(0, 80) : s;
}

function normalizeText(v) {
  const s = safeText(v).trim();
  if (!s) return "";
  return s.length > 2000 ? s.slice(0, 2000) : s;
}

function normalizeArtistId(v) {
  return safeText(v).trim();
}

function requireAdmin(req, res, next) {
  const key = safeText(process.env.ADMIN_KEY).trim();
  if (!key) return next(); // dev mode (open)

  const got = safeText(req.headers["x-admin-key"]).trim();
  if (!got || got !== key) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  return next();
}

function ok(res, data, meta) {
  const payload = { success: true, data };
  if (meta) payload.meta = meta;
  return res.status(200).json(payload);
}

function badRequest(res, message, errors) {
  const payload = { success: false, message: message || "Bad request." };
  if (errors) payload.errors = errors;
  return res.status(400).json(payload);
}

function notFound(res, message) {
  return res.status(404).json({ success: false, message: message || "Not found." });
}

// ----------------------
// Public routes
// ----------------------

// GET /comments?artistId=:id
commentsRouter.get("/comments", (req, res) => {
  const artistId = normalizeArtistId(req.query.artistId);

  const list = commentsStore.listComments({ artistId: artistId || undefined });
  return ok(res, list, {
    artistId: artistId || null,
    total: Array.isArray(list) ? list.length : 0,
  });
});

// GET /artists/:id/comments
commentsRouter.get("/artists/:id/comments", (req, res) => {
  const artistId = normalizeArtistId(req.params.id);
  if (!artistId) return badRequest(res, "artistId is required");

  const artist = artistsStore.getArtist(artistId);
  if (!artist) return notFound(res, "Artist not found.");

  const list = commentsStore.listComments({ artistId });
  return ok(res, list, { artistId, total: list.length });
});

// POST /comments  { artistId, name, text }
commentsRouter.post("/comments", express.json({ limit: "50kb" }), (req, res) => {
  const errors = [];

  const artistId = normalizeArtistId(req.body?.artistId);
  const name = normalizeName(req.body?.name);
  const text = normalizeText(req.body?.text);

  if (!artistId) errors.push({ field: "artistId", message: "artistId is required." });
  if (!text) errors.push({ field: "text", message: "text is required." });

  if (errors.length) return badRequest(res, "Validation failed.", errors);

  const artist = artistsStore.getArtist(artistId);
  if (!artist) return notFound(res, "Artist not found.");

  const created = commentsStore.createComment({ artistId, name, text });
  if (created?.error) {
    return badRequest(res, created.error);
  }

  return res.status(201).json({ success: true, data: created });
});

// ----------------------
// Admin moderation
// ----------------------

// DELETE /admin/comments/:id
commentsRouter.delete("/admin/comments/:id", requireAdmin, (req, res) => {
  const id = safeText(req.params.id).trim();
  if (!id) return badRequest(res, "id is required");

  const existing = commentsStore.getComment(id);
  if (!existing) return notFound(res, "Comment not found.");

  const okDel = commentsStore.deleteComment(id);
  return res.status(200).json({ success: true, data: { id, deleted: !!okDel } });
});

// DELETE /api/admin/comments/:id
commentsRouter.delete("/api/admin/comments/:id", requireAdmin, (req, res) => {
  const id = safeText(req.params.id).trim();
  if (!id) return badRequest(res, "id is required");

  const existing = commentsStore.getComment(id);
  if (!existing) return notFound(res, "Comment not found.");

  const okDel = commentsStore.deleteComment(id);
  return res.status(200).json({ success: true, data: { id, deleted: !!okDel } });
});