// votes.js (ESM)
// Public votes API for iBand
// In-memory voting with simple anti-spam options (future-ready)

import express from "express";

const router = express.Router();

// In-memory votes map: artistId -> votes
const votesByArtistId = new Map();

/**
 * Helpers
 */
function asArtistId(v) {
  return String(v).trim();
}

function getVotes(artistId) {
  const id = asArtistId(artistId);
  return votesByArtistId.get(id) || 0;
}

function setVotes(artistId, value) {
  const id = asArtistId(artistId);
  const n = Number(value);
  votesByArtistId.set(id, Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
  return votesByArtistId.get(id);
}

function incVotes(artistId, amount = 1) {
  const id = asArtistId(artistId);
  const curr = getVotes(id);
  const a = Number(amount);
  const inc = Number.isFinite(a) ? Math.floor(a) : 1;
  const next = Math.max(0, curr + inc);
  votesByArtistId.set(id, next);
  return next;
}

/**
 * GET /api/votes
 * List all vote totals
 */
router.get("/", (req, res) => {
  const all = Array.from(votesByArtistId.entries()).map(([artistId, votes]) => ({
    artistId,
    votes,
  }));

  return res.status(200).json({
    success: true,
    count: all.length,
    votes: all,
  });
});

/**
 * GET /api/votes/:artistId
 * Get votes for an artist
 */
router.get("/:artistId", (req, res) => {
  const { artistId } = req.params;
  return res.status(200).json({
    success: true,
    artistId: asArtistId(artistId),
    votes: getVotes(artistId),
  });
});

/**
 * POST /api/votes/:artistId
 * Increment votes by 1 (default) or by { amount }
 * Body optional: { amount: 1 }
 */
router.post("/:artistId", (req, res) => {
  const { artistId } = req.params;
  const { amount } = req.body || {};

  const next = incVotes(artistId, amount ?? 1);

  return res.status(200).json({
    success: true,
    message: "Vote recorded.",
    artistId: asArtistId(artistId),
    votes: next,
  });
});

/**
 * PUT /api/votes/:artistId
 * Set votes to an absolute number
 * Body: { votes: number }
 */
router.put("/:artistId", (req, res) => {
  const { artistId } = req.params;
  const { votes } = req.body || {};

  if (votes === undefined) {
    return res.status(400).json({
      success: false,
      message: "votes is required",
    });
  }

  const next = setVotes(artistId, votes);

  return res.status(200).json({
    success: true,
    message: "Votes set.",
    artistId: asArtistId(artistId),
    votes: next,
  });
});

/**
 * POST /api/votes/reset
 * Reset all votes
 */
router.post("/reset", (req, res) => {
  votesByArtistId.clear();
  return res.status(200).json({
    success: true,
    message: "All votes reset.",
  });
});

export default router;