// votes.js (ESM)
// Votes API — MUST read the same artistsStore instance as artists.js/adminArtists.js
//
// Mounted at: /api/votes
//
// Supports:
// - GET  /api/votes/:id              -> get votes for artist
// - POST /api/votes/:id              -> add votes (body: { amount: 1 } or { amount: 5 })
// - POST /api/votes/:id/plus1        -> add +1 (legacy convenience)
// - POST /api/votes/:id/plus5        -> add +5 (legacy convenience)

import express from "express";
import artistsStore from "./artistsStore.js";

const router = express.Router();

const safeText = (v) => (v === null || v === undefined ? "" : String(v)).trim();

function toInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function getArtistOr404(req, res) {
  const id = safeText(req.params.id);
  if (!id) {
    res.status(400).json({ success: false, message: "Artist id is required." });
    return null;
  }

  // IMPORTANT: single source of truth
  const artist = artistsStore.getArtist(id) || artistsStore.getById?.(id) || null;

  if (!artist) {
    res.status(404).json({ success: false, message: "Artist not found.", id });
    return null;
  }

  return artist;
}

/**
 * GET /api/votes/:id
 */
router.get("/:id", (req, res) => {
  const artist = getArtistOr404(req, res);
  if (!artist) return;

  return res.status(200).json({
    success: true,
    id: artist.id,
    votes: Number(artist.votes) || 0,
  });
});

/**
 * POST /api/votes/:id
 * Body: { amount: 1 } or { amount: 5 }
 */
router.post("/:id", (req, res) => {
  const artist = getArtistOr404(req, res);
  if (!artist) return;

  const amountFromBody = req?.body?.amount;
  const amountFromQuery = req?.query?.amount;

  const amount = toInt(amountFromBody ?? amountFromQuery, 1);

  if (![1, 5, 10, 25].includes(amount)) {
    return res.status(400).json({
      success: false,
      message: "Invalid vote amount. Allowed: 1, 5, 10, 25.",
    });
  }

  const nextVotes = (Number(artist.votes) || 0) + amount;

  // Persist + update in-memory via the SAME store
  const updated =
    artistsStore.patchArtist?.(artist.id, { votes: nextVotes }) ||
    artistsStore.patch?.(artist.id, { votes: nextVotes }) ||
    artistsStore.updateArtist?.(artist.id, { votes: nextVotes }) ||
    artistsStore.update?.(artist.id, { votes: nextVotes });

  if (!updated) {
    return res.status(500).json({
      success: false,
      message: "Failed to update votes.",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Votes updated.",
    id: updated.id,
    delta: amount,
    votes: Number(updated.votes) || 0,
    artist: updated,
  });
});

/**
 * POST /api/votes/:id/plus1
 */
router.post("/:id/plus1", (req, res) => {
  req.body = { ...(req.body || {}), amount: 1 };
  return router.handle(req, res);
});

/**
 * POST /api/votes/:id/plus5
 */
router.post("/:id/plus5", (req, res) => {
  req.body = { ...(req.body || {}), amount: 5 };
  return router.handle(req, res);
});

export default router;