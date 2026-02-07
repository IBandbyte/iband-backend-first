/**
 * votes.js (ESM)
 *
 * Votes API
 * - Must always read/write via the SAME artistsStore reference used by artists.js + adminArtists.js
 * - Must survive Render cold starts by forcing store hydration from disk on router load
 *
 * Routes:
 *   GET    /api/votes/:id                 -> get current votes for artist
 *   POST   /api/votes/:id                 -> add votes (body: { delta } or { amount })
 *   POST   /api/votes/:id/plus-one        -> add +1
 *   POST   /api/votes/:id/plus-five       -> add +5
 */

import express from "express";
import artistsStore from "./artistsStore.js";

const router = express.Router();

/* -------------------------------------------------------
   CRITICAL (Winning Pattern)
   Force store hydration from disk on cold start.
   This prevents: votes route saying "Artist not found"
   while artists/admin routes can see the artist.
-------------------------------------------------------- */
artistsStore.listArtists();

/* -------------------- Helpers -------------------- */

function safeText(v) {
  return v === null || v === undefined ? "" : String(v).trim();
}

function toInt(v, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function clampVotesDelta(delta) {
  // Safety: prevent crazy values, but still allow reasonable boosts
  const d = toInt(delta, 0);
  if (d > 1000) return 1000;
  if (d < -1000) return -1000;
  return d;
}

function findArtistOrNull(id) {
  const clean = safeText(id);
  if (!clean) return null;

  // Support both store styles:
  // - modern: getArtist
  // - alias: getById
  return (
    (typeof artistsStore.getArtist === "function" ? artistsStore.getArtist(clean) : null) ||
    (typeof artistsStore.getById === "function" ? artistsStore.getById(clean) : null)
  );
}

function patchArtistOrNull(id, patch) {
  const clean = safeText(id);
  if (!clean) return null;

  // Support both store styles:
  // - modern: patchArtist
  // - alias: patch
  if (typeof artistsStore.patchArtist === "function") return artistsStore.patchArtist(clean, patch);
  if (typeof artistsStore.patch === "function") return artistsStore.patch(clean, patch);
  return null;
}

/* -------------------- Routes -------------------- */

// GET /api/votes/:id
router.get("/:id", (req, res) => {
  const id = safeText(req.params.id);
  const artist = findArtistOrNull(id);

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
    status: safeText(artist.status),
    updatedAt: safeText(artist.updatedAt),
  });
});

// POST /api/votes/:id  (body: { delta } or { amount })
router.post("/:id", (req, res) => {
  const id = safeText(req.params.id);
  const artist = findArtistOrNull(id);

  if (!artist) {
    return res.status(404).json({
      success: false,
      message: "Artist not found.",
      id,
    });
  }

  const deltaRaw = req.body?.delta ?? req.body?.amount ?? req.query?.delta ?? req.query?.amount;
  const delta = clampVotesDelta(deltaRaw);

  if (delta === 0) {
    return res.status(400).json({
      success: false,
      message: "Vote delta is required (non-zero).",
      id,
      hint: "Send JSON body like { \"delta\": 1 } or { \"amount\": 5 }",
    });
  }

  const nextVotes = Math.max(0, toInt(artist.votes, 0) + delta);
  const updated = patchArtistOrNull(id, { votes: nextVotes });

  if (!updated) {
    return res.status(500).json({
      success: false,
      message: "Failed to persist vote update.",
      id,
    });
  }

  return res.json({
    success: true,
    message: "Vote recorded.",
    id: updated.id,
    delta,
    votes: toInt(updated.votes, 0),
    updatedAt: safeText(updated.updatedAt),
  });
});

// POST /api/votes/:id/plus-one
router.post("/:id/plus-one", (req, res) => {
  req.body = { ...(req.body || {}), delta: 1 };
  return router.handle({ ...req, url: `/${req.params.id}`, method: "POST" }, res);
});

// POST /api/votes/:id/plus-five
router.post("/:id/plus-five", (req, res) => {
  req.body = { ...(req.body || {}), delta: 5 };
  return router.handle({ ...req, url: `/${req.params.id}`, method: "POST" }, res);
});

export default router;