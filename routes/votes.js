/* eslint-env node */

// routes/votes.js — votes & leaderboard API
// - GET /votes        -> list artists with vote counts (desc)
// - GET /votes/:id    -> single artist vote snapshot

const express = require("express");
const mongoose = require("mongoose");
const isObjectId = require("../utils/isObjectId");

const router = express.Router();

/* ----------------------------------------
 * Artist model (shared with artists.js)
 * -------------------------------------- */
const Artist =
  mongoose.models.Artist ||
  mongoose.model(
    "Artist",
    new mongoose.Schema(
      {
        name: { type: String, required: true, trim: true },
        genre: { type: String, default: "" },
        votes: { type: Number, default: 0 },
        commentsCount: { type: Number, default: 0 },
      },
      { collection: "artists", timestamps: false }
    )
  );

/* ----------------------------------------
 * GET /votes — leaderboard
 * -------------------------------------- */
router.get("/votes", async (_req, res) => {
  try {
    const list = await Artist.find(
      {},
      { name: 1, genre: 1, votes: 1, commentsCount: 1 }
    )
      .sort({ votes: -1, name: 1 })
      .lean();

    return res.json({ ok: true, count: list.length, artists: list });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Failed to fetch votes" });
  }
});

/* ----------------------------------------
 * GET /votes/:id — single artist vote summary
 * -------------------------------------- */
router.get("/votes/:id", async (req, res) => {
  const { id } = req.params;

  if (!isObjectId(id)) {
    return res.status(400).json({ ok: false, error: "Invalid artist ID" });
  }

  try {
    const artist = await Artist.findById(id, {
      name: 1,
      genre: 1,
      votes: 1,
      commentsCount: 1,
    }).lean();

    if (!artist) {
      return res.status(404).json({ ok: false, error: "Artist not found" });
    }

    return res.json({
      ok: true,
      id: String(artist._id),
      name: artist.name,
      genre: artist.genre,
      votes: artist.votes || 0,
      commentsCount: artist.commentsCount || 0,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Failed to fetch vote" });
  }
});

module.exports = router;