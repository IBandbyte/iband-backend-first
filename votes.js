/**
 * votes.js — iBand Backend
 *
 * CRITICAL RULE:
 * Votes MUST operate on the SAME in-memory artist objects
 * as artists.js and admin.js.
 *
 * No rehydration tricks.
 * No detached helpers.
 * One store. One truth.
 */

import express from "express";
import artistsStore from "./artistsStore.js";

const router = express.Router();

/* -------------------------------------------------
   HARD GUARANTEE STORE IS LOADED (cold start safe)
-------------------------------------------------- */
artistsStore.listArtists();

/* ---------------- Utilities ---------------- */

const clean = (v) => (v === null || v === undefined ? "" : String(v).trim());
const toInt = (v, f = 0) => (Number.isFinite(+v) ? Math.trunc(+v) : f);

/* ---------------- Core Lookup ---------------- */

function findArtist(id) {
  const cid = clean(id);
  if (!cid) return null;

  // IMPORTANT:
  // Access the SAME array reference used everywhere else
  return artistsStore.artists.find((a) => a.id === cid) || null;
}

/* ---------------- Routes ---------------- */

// GET /api/votes/:id
router.get("/:id", (req, res) => {
  const id = clean(req.params.id);
  const artist = findArtist(id);

  if (!artist) {
    return res.status(404).json({
      success: false,
      message: "Artist not found.",
      id,
    });
  }

  return res.json({
    success: true,
    id: artist.id,
    votes: toInt(artist.votes, 0),
    status: artist.status,
    updatedAt: artist.updatedAt,
  });
});

// POST /api/votes/:id
router.post("/:id", (req, res) => {
  const id = clean(req.params.id);
  const artist = findArtist(id);

  if (!artist) {
    return res.status(404).json({
      success: false,
      message: "Artist not found.",
      id,
    });
  }

  const deltaRaw = req.body?.delta ?? req.body?.amount;
  const delta = toInt(deltaRaw, 0);

  if (!delta) {
    return res.status(400).json({
      success: false,
      message: "Vote delta required.",
      example: { delta: 1 },
    });
  }

  artist.votes = Math.max(0, toInt(artist.votes, 0) + delta);
  artist.updatedAt = new Date().toISOString();

  artistsStore.save();

  return res.json({
    success: true,
    message: "Vote recorded.",
    id: artist.id,
    votes: artist.votes,
    updatedAt: artist.updatedAt,
  });
});

// POST /api/votes/:id/plus-one
router.post("/:id/plus-one", (req, res) => {
  req.body = { delta: 1 };
  req.url = `/${req.params.id}`;
  return router.handle(req, res);
});

// POST /api/votes/:id/plus-five
router.post("/:id/plus-five", (req, res) => {
  req.body = { delta: 5 };
  req.url = `/${req.params.id}`;
  return router.handle(req, res);
});

export default router;