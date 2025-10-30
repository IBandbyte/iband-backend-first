/* eslint-env node */

// artists.js — artist listing + single fetch + simple vote endpoint

const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// Model definition (shared shape with votes route)
const Artist =
  mongoose.models.Artist ||
  mongoose.model(
    "Artist",
    new mongoose.Schema(
      {
        name: { type: String, required: true },
        genre: { type: String, default: "" },
        votes: { type: Number, default: 0 },
        commentsCount: { type: Number, default: 0 },
      },
      { collection: "artists", timestamps: false }
    )
  );

// GET /artists — list artists (minimal projection)
router.get("/", async (_req, res) => {
  try {
    const list = await Artist.find({}, { name: 1, genre: 1, votes: 1, commentsCount: 1 })
      .sort({ name: 1 })
      .lean();
    res.json(list);
  } catch (_e) {
    res.status(500).json({ error: "Failed to fetch artists" });
  }
});

// GET /artists/:id — fetch single artist
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid artist id" });
    }
    const artist = await Artist.findById(id, { name: 1, genre: 1, votes: 1, commentsCount: 1 }).lean();
    if (!artist) return res.status(404).json({ error: "Artist not found" });
    res.json(artist);
  } catch (_e) {
    res.status(500).json({ error: "Failed to fetch artist" });
  }
});

// POST /artists/:id/vote — bump vote counter
// Body: { delta: +1 | -1 }
router.post("/:id/vote", async (req, res) => {
  try {
    const { id } = req.params;
    const n = Number((req.body || {}).delta);

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid artist id" });
    }
    if (![1, -1].includes(n)) {
      return res.status(400).json({ error: "delta must be +1 or -1" });
    }

    const updated = await Artist.findByIdAndUpdate(
      id,
      { $inc: { votes: n } },
      { new: true, projection: { name: 1, votes: 1 } }
    ).lean();

    if (!updated) return res.status(404).json({ error: "Artist not found" });

    res.json({ id: String(updated._id), name: updated.name, votes: updated.votes || 0 });
  } catch (_e) {
    res.status(500).json({ error: "Failed to update vote" });
  }
});

module.exports = router;