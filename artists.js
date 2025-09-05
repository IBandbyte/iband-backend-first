// artists.js — public artists endpoints (model included here)
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// Reuse/define Artist model locally (no separate models folder needed)
const Artist =
  mongoose.models.Artist ||
  mongoose.model(
    "Artist",
    new mongoose.Schema(
      {
        name: { type: String, required: true, trim: true },
        genre: { type: String, default: "No genre set", trim: true },
        bio: { type: String, default: "" },
        imageUrl: { type: String, default: "" },
        votes: { type: Number, default: 0 },
      },
      { timestamps: true }
    )
  );

// GET /artists — list artists (name + genre), sorted A→Z
router.get("/", async (_req, res) => {
  try {
    const list = await Artist.find({}, { _id: 0, name: 1, genre: 1 }).sort({ name: 1 });
    res.json(list);
  } catch (err) {
    console.error("GET /artists failed:", err);
    res.status(500).json({ error: "Failed to fetch artists" });
  }
});

module.exports = router;