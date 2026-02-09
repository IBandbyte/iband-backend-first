// votes.js
// iBand Backend — Votes Routes (ESM)
// Winning pattern/formula: single source of truth via artistsStore + consistent JSON + future-proof endpoints

import express from "express";
import artistsStore from "./artistsStore.js";

const router = express.Router();

/* -------------------- Helpers -------------------- */

const safeText = (v) => (v === null || v === undefined ? "" : String(v)).trim();

const toInt = (v, fallback = 0) => {
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
};

function getStoreFns(store) {
  // supports BOTH:
  // - modern: getArtist/patchArtist
  // - alias: getById/patch
  const getArtist =
    typeof store.getArtist === "function"
      ? store.getArtist.bind(store)
      : typeof store.getById === "function"
      ? store.getById.bind(store)
      : null;

  const patchArtist =
    typeof store.patchArtist === "function"
      ? store.patchArtist.bind(store)
      : typeof store.patch === "function"
      ? store.patch.bind(store)
      : null;

  return { getArtist, patchArtist };
}

const { getArtist, patchArtist } = getStoreFns(artistsStore);

/* -------------------- Guards -------------------- */

router.use((req, res, next) => {
  if (!getArtist || !patchArtist) {
    return res.status(500).json({
      success: false,
      message:
        "Votes API misconfigured: artistsStore is missing getArtist/getById or patchArtist/patch.",
    });
  }
  next();
});

/* -------------------- Routes -------------------- */
/**
 * GET /api/votes/:id
 * Returns vote info for a given artist id.
 */
router.get("/:id", (req, res) => {
  const id = safeText(req.params.id);

  if (!id) {
    return res.status(400).json({ success: false, message: "Artist id is required." });
  }

  const artist = getArtist(id);

  if (!artist) {
    return res.status(404).json({ success: false, message: "Artist not found.", id });
  }

  return res.json({
    success: true,
    id: artist.id,
    votes: toInt(artist.votes, 0),
    status: artist.status,
    artist: {
      id: artist.id,
      name: artist.name,
      votes: toInt(artist.votes, 0),
      status: artist.status,
      updatedAt: artist.updatedAt,
    },
  });
});

/**
 * POST /api/votes/:id
 * Increments votes for an artist.
 *
 * Body accepted:
 * - { "delta": 1 } or { "amount": 1 } or { "value": 1 }
 * If omitted, defaults to +1.
 * Safety:
 * - clamps delta to [-100, 100]
 */
router.post("/:id", (req, res) => {
  const id = safeText(req.params.id);

  if (!id) {
    return res.status(400).json({ success: false, message: "Artist id is required." });
  }

  const artist = getArtist(id);

  if (!artist) {
    return res.status(404).json({ success: false, message: "Artist not found.", id });
  }

  const rawDelta =
    req.body?.delta !== undefined
      ? req.body.delta
      : req.body?.amount !== undefined
      ? req.body.amount
      : req.body?.value !== undefined
      ? req.body.value
      : 1;

  let delta = toInt(rawDelta, 1);
  if (delta > 100) delta = 100;
  if (delta < -100) delta = -100;

  const current = toInt(artist.votes, 0);
  const nextVotes = current + delta;

  const updated = patchArtist(id, { votes: nextVotes });

  if (!updated) {
    // ultra-rare: store failed mid-flight
    return res.status(500).json({
      success: false,
      message: "Failed to apply vote update.",
      id,
    });
  }

  return res.json({
    success: true,
    message: "Vote recorded.",
    id: updated.id,
    delta,
    votes: toInt(updated.votes, 0),
    artist: {
      id: updated.id,
      name: updated.name,
      votes: toInt(updated.votes, 0),
      status: updated.status,
      updatedAt: updated.updatedAt,
    },
  });
});

/**
 * POST /api/votes/:id/quick
 * Convenience voting endpoint for UI buttons.
 *
 * Body accepted:
 * - { "type": "plus1" | "plus5" | "minus1" | "minus5" }
 * Defaults to "plus1"
 */
router.post("/:id/quick", (req, res) => {
  const id = safeText(req.params.id);

  if (!id) {
    return res.status(400).json({ success: false, message: "Artist id is required." });
  }

  const artist = getArtist(id);

  if (!artist) {
    return res.status(404).json({ success: false, message: "Artist not found.", id });
  }

  const type = safeText(req.body?.type || "plus1").toLowerCase();

  const map = {
    plus1: 1,
    plus5: 5,
    minus1: -1,
    minus5: -5,
  };

  const delta = map[type] ?? 1;
  const current = toInt(artist.votes, 0);
  const updated = patchArtist(id, { votes: current + delta });

  if (!updated) {
    return res.status(500).json({
      success: false,
      message: "Failed to apply vote update.",
      id,
    });
  }

  return res.json({
    success: true,
    message: "Vote recorded.",
    id: updated.id,
    type,
    delta,
    votes: toInt(updated.votes, 0),
  });
});

export default router;