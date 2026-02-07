// votes.js
// iBand Votes API — canonical implementation (ESM)
// SINGLE SOURCE OF TRUTH: artistsStore
// Purpose: get votes, increment votes, set/reset votes safely.

import express from "express";
import artistsStore from "./artistsStore.js";

const router = express.Router();

/* -------------------- Helpers -------------------- */

function safeText(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function ensureNonNegativeInt(n) {
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i < 0) return null;
  return i;
}

function findArtistOr404(res, id) {
  const clean = safeText(id);
  const artist = artistsStore.getArtist(clean);

  if (!artist) {
    res.status(404).json({
      success: false,
      message: "Artist not found.",
      id: clean,
    });
    return null;
  }

  return artist;
}

/* -------------------- Routes -------------------- */

/**
 * GET /api/votes/:id
 * Returns votes for an artist
 */
router.get("/:id", (req, res) => {
  const { id } = req.params;
  const artist = findArtistOr404(res, id);
  if (!artist) return;

  res.json({
    success: true,
    id: artist.id,
    votes: toNumber(artist.votes, 0),
  });
});

/**
 * POST /api/votes/:id
 * Body: { amount?: number }  (default 1)
 * Increments votes (amount must be positive)
 */
router.post("/:id", (req, res) => {
  const { id } = req.params;
  const amountRaw = req.body?.amount ?? 1;
  const amount = toNumber(amountRaw, NaN);

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid vote amount. Use a positive number.",
      received: amountRaw,
    });
  }

  const artist = findArtistOr404(res, id);
  if (!artist) return;

  const currentVotes = toNumber(artist.votes, 0);
  const nextVotes = ensureNonNegativeInt(currentVotes + amount);

  if (nextVotes === null) {
    return res.status(400).json({
      success: false,
      message: "Vote total would become invalid.",
      currentVotes,
      amount,
    });
  }

  const updated = artistsStore.patchArtist(artist.id, { votes: nextVotes });

  return res.json({
    success: true,
    message: "Vote recorded.",
    id: updated.id,
    votes: toNumber(updated.votes, 0),
    artist: updated,
  });
});

/**
 * POST /api/votes/:id/plus1
 * Convenience for UI buttons
 */
router.post("/:id/plus1", (req, res) => {
  req.body = { amount: 1 };
  return router.handle(req, res, () => {});
});

/**
 * POST /api/votes/:id/plus5
 * Convenience for UI buttons
 */
router.post("/:id/plus5", (req, res) => {
  req.body = { amount: 5 };
  return router.handle(req, res, () => {});
});

/**
 * PATCH /api/votes/:id
 * Body: { votes: number }  (sets votes exactly; must be >= 0 integer)
 * Useful for admin/debug tools
 */
router.patch("/:id", (req, res) => {
  const { id } = req.params;
  const votesRaw = req.body?.votes;
  const votesNum = toNumber(votesRaw, NaN);
  const votes = ensureNonNegativeInt(votesNum);

  if (votes === null) {
    return res.status(400).json({
      success: false,
      message: "Invalid votes value. Must be an integer >= 0.",
      received: votesRaw,
    });
  }

  const artist = findArtistOr404(res, id);
  if (!artist) return;

  const updated = artistsStore.patchArtist(artist.id, { votes });

  return res.json({
    success: true,
    message: "Votes set successfully.",
    id: updated.id,
    votes: toNumber(updated.votes, 0),
    artist: updated,
  });
});

/**
 * DELETE /api/votes/:id
 * Resets votes back to 0 (admin/debug)
 */
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const artist = findArtistOr404(res, id);
  if (!artist) return;

  const updated = artistsStore.patchArtist(artist.id, { votes: 0 });

  return res.json({
    success: true,
    message: "Votes reset successfully.",
    id: updated.id,
    votes: toNumber(updated.votes, 0),
    artist: updated,
  });
});

export default router;