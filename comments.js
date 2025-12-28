import express from "express";

/**
 * iBand Comments Router (Phase 2.2.1)
 *
 * Mount target (recommended):
 *   app.use("/artists/:id", commentsRouter);
 *
 * Endpoints:
 *   GET  /artists/:id/comments
 *   POST /artists/:id/comments
 *
 * Also includes compatibility endpoints (optional but future-proof):
 *   GET  /comments?artistId=:id
 *   POST /comments  { artistId, name, text }
 *
 * Storage:
 *   In-memory (Map). This is intentional for Phase 2.x.
 *   Later phases can swap to DB with same API shape.
 */

export const commentsRouter = express.Router({ mergeParams: true });

// In-memory store: artistId -> comments[]
const COMMENTS_BY_ARTIST = new Map();

const LIMITS = {
  nameMin: 2,
  nameMax: 40,
  textMin: 2,
  textMax: 500,
  listMax: 200,
};

function nowIso() {
  return new Date().toISOString();
}

function safeText(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function normalizeArtistId(v) {
  return safeText(v).trim();
}

function cleanName(v) {
  return safeText(v).trim().replace(/\s+/g, " ").slice(0, LIMITS.nameMax);
}

function cleanText(v) {
  return safeText(v).trim().replace(/\s+/g, " ").slice(0, LIMITS.textMax);
}

function makeId(prefix = "c") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function ok(res, data, meta) {
  return res.json({ success: true, data, ...(meta ? { meta } : {}) });
}

function fail(res, status, message, details) {
  return res.status(status).json({
    success: false,
    error: message,
    ...(details ? { details } : {}),
  });
}

function getList(artistId) {
  const id = normalizeArtistId(artistId);
  if (!id) return [];
  return COMMENTS_BY_ARTIST.get(id) || [];
}

function setList(artistId, list) {
  const id = normalizeArtistId(artistId);
  if (!id) return;
  COMMENTS_BY_ARTIST.set(id, list);
}

function validateCommentPayload({ name, text }) {
  const n = cleanName(name);
  const t = cleanText(text);

  const issues = [];
  if (n.length < LIMITS.nameMin) issues.push(`name must be at least ${LIMITS.nameMin} characters`);
  if (t.length < LIMITS.textMin) issues.push(`text must be at least ${LIMITS.textMin} characters`);

  return { ok: issues.length === 0, issues, name: n, text: t };
}

/**
 * Primary routes (mounted at /artists/:id)
 */

// GET /artists/:id/comments
commentsRouter.get("/comments", (req, res) => {
  const artistId = normalizeArtistId(req.params.id);
  if (!artistId) return fail(res, 400, "Missing artist id");

  const list = getList(artistId);

  // latest first
  const sorted = [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return ok(res, sorted.slice(0, LIMITS.listMax), {
    artistId,
    count: sorted.length,
  });
});

// POST /artists/:id/comments  { name, text }
commentsRouter.post("/comments", (req, res) => {
  const artistId = normalizeArtistId(req.params.id);
  if (!artistId) return fail(res, 400, "Missing artist id");

  const { name, text } = req.body || {};
  const v = validateCommentPayload({ name, text });

  if (!v.ok) {
    return fail(res, 400, "Invalid comment payload", { issues: v.issues });
  }

  const newComment = {
    id: makeId("comment"),
    artistId,
    name: v.name,
    text: v.text,
    createdAt: nowIso(),
  };

  const list = getList(artistId);
  const next = [newComment, ...list].slice(0, LIMITS.listMax);
  setList(artistId, next);

  return ok(res, newComment, { artistId });
});

/**
 * Compatibility endpoints (optional but helps later phases + tooling)
 * If you mount this router at "/" as well, these are ready.
 */

// GET /comments?artistId=:id
commentsRouter.get("/", (req, res) => {
  const artistId = normalizeArtistId(req.query.artistId);
  if (!artistId) return fail(res, 400, "Missing artistId query param");

  const list = getList(artistId);
  const sorted = [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return ok(res, sorted.slice(0, LIMITS.listMax), {
    artistId,
    count: sorted.length,
  });
});

// POST /comments  { artistId, name, text }
commentsRouter.post("/", (req, res) => {
  const { artistId, name, text } = req.body || {};
  const id = normalizeArtistId(artistId);
  if (!id) return fail(res, 400, "Missing artistId");

  const v = validateCommentPayload({ name, text });
  if (!v.ok) return fail(res, 400, "Invalid comment payload", { issues: v.issues });

  const newComment = {
    id: makeId("comment"),
    artistId: id,
    name: v.name,
    text: v.text,
    createdAt: nowIso(),
  };

  const list = getList(id);
  const next = [newComment, ...list].slice(0, LIMITS.listMax);
  setList(id, next);

  return ok(res, newComment, { artistId: id });
});