// votes.js (ESM)
// Votes API — updates artistsStore (single source of truth) so votes persist across deploys.
//
// Mounted at: /api/votes
//
// Supports:
// - GET  /api/votes/:id              -> get current votes for artist
// - POST /api/votes/:id              -> increment votes (body optional: { delta })
// - POST /api/votes                  -> increment votes (body: { id, delta })
// - GET  /api/votes/leaderboard      -> basic leaderboard (top N, optional ?limit=10&status=active)
// - POST /api/votes/:id/reset        -> reset votes to 0 (admin only header x-admin-key)
//
// Notes:
// - Uses artistsStore.patchArtist() so updates persist to ./db/artists.json and stay consistent in memory.

import express from "express";
import artistsStore from "./artistsStore.js";

const router = express.Router();

/* -------------------- Helpers -------------------- */

const safeText = (v) => (v === null || v === undefined ? "" : String(v)).trim();

function toInt(v, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function isAdmin(req) {
  // Optional: set ADMIN_KEY in Render env later.
  const adminKey = safeText(process.env.ADMIN_KEY);
  if (!adminKey) return false; // if not configured, no one is admin
  const provided = safeText(req.headers["x-admin-key"]);
  return provided && provided === adminKey;
}

function getArtistIdFromReq(req) {
  return safeText(req.params.id || req.body?.id);
}

function clampDelta(delta) {
  // Allow negative for future undo, but clamp to prevent abuse
  // Range: -50..+50
  const d = toInt(delta, 1);
  if (d > 50) return 50;
  if (d < -50) return -50;
  return d;
}

function notFound(res, id) {
  return res.status(404).json({ success: false, message: "Artist not found.", id });
}

/* -------------------- Routes -------------------- */

/**
 * GET /api/votes/leaderboard?limit=10&status=active
 */
router.get("/leaderboard", (req, res) => {
  const limit = Math.max(1, Math.min(50, toInt(req.query.limit, 10)));
  const status = safeText(req.query.status || "active").toLowerCase();

  const list = artistsStore.listArtists();

  const filtered =
    status === "all"
      ? list
      : list.filter((a) => safeText(a?.status).toLowerCase() === status);

  const top = [...filtered]
    .sort((a, b) => (Number(b?.votes) || 0) - (Number(a?.votes) || 0))
    .slice(0, limit)
    .map((a) => ({
      id: a.id,
      name: a.name,
      votes: Number(a.votes) || 0,
      status: a.status,
    }));

  return res.status(200).json({
    success: true,
    count: top.length,
    limit,
    status,
    leaderboard: top,
  });
});

/**
 * GET /api/votes/:id
 * Get current votes for an artist.
 */
router.get("/:id", (req, res) => {
  const id = getArtistIdFromReq(req);
  if (!id) return res.status(400).json({ success: false, message: "Artist id is required." });

  const artist = artistsStore.getArtist(id);
  if (!artist) return notFound(res, id);

  return res.status(200).json({
    success: true,
    id: artist.id,
    votes: Number(artist.votes) || 0,
    status: artist.status,
    updatedAt: artist.updatedAt,
  });
});

/**
 * POST /api/votes
 * Body: { id, delta }
 */
router.post("/", (req, res) => {
  const id = getArtistIdFromReq(req);
  if (!id) return res.status(400).json({ success: false, message: "Artist id is required." });

  const artist = artistsStore.getArtist(id);
  if (!artist) return notFound(res, id);

  const delta = clampDelta(req.body?.delta);
  const nextVotes = Math.max(0, (Number(artist.votes) || 0) + delta);

  const updated = artistsStore.patchArtist(id, { votes: nextVotes });
  if (!updated) return notFound(res, id);

  return res.status(200).json({
    success: true,
    message: "Vote applied.",
    id: updated.id,
    delta,
    votes: Number(updated.votes) || 0,
    updatedAt: updated.updatedAt,
  });
});

/**
 * POST /api/votes/:id
 * Body optional: { delta }
 * Defaults to +1 if no delta provided.
 */
router.post("/:id", (req, res) => {
  const id = getArtistIdFromReq(req);
  if (!id) return res.status(400).json({ success: false, message: "Artist id is required." });

  const artist = artistsStore.getArtist(id);
  if (!artist) return notFound(res, id);

  const delta = clampDelta(req.body?.delta);
  const nextVotes = Math.max(0, (Number(artist.votes) || 0) + delta);

  const updated = artistsStore.patchArtist(id, { votes: nextVotes });
  if (!updated) return notFound(res, id);

  return res.status(200).json({
    success: true,
    message: "Vote applied.",
    id: updated.id,
    delta,
    votes: Number(updated.votes) || 0,
    updatedAt: updated.updatedAt,
  });
});

/**
 * POST /api/votes/:id/reset
 * Admin only (x-admin-key must match ADMIN_KEY).
 */
router.post("/:id/reset", (req, res) => {
  const id = getArtistIdFromReq(req);
  if (!id) return res.status(400).json({ success: false, message: "Artist id is required." });

  if (!isAdmin(req)) {
    return res.status(401).json({ success: false, message: "Unauthorized (admin key required)." });
  }

  const artist = artistsStore.getArtist(id);
  if (!artist) return notFound(res, id);

  const updated = artistsStore.patchArtist(id, { votes: 0 });
  if (!updated) return notFound(res, id);

  return res.status(200).json({
    success: true,
    message: "Votes reset.",
    id: updated.id,
    votes: 0,
    updatedAt: updated.updatedAt,
  });
});

export default router;