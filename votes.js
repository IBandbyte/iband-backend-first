// votes.js — upvote counter by artist name (flat)
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Artist =
  mongoose.models.Artist ||
  mongoose.model(
    "Artist",
    new mongoose.Schema(
      {
        name: { type: String, required: true, unique: true },
        genre: { type: String, default: "No genre set" },
        votes: { type: Number, default: 0 },
      },
      { timestamps: true }
    )
  );

// GET /votes?artist=Aria%20Nova
router.get("/", async (req, res) => {
  try {
    const name = (req.query.artist || "").trim();
    if (!name) return res.status(400).json({ error: "artist query required" });
    const a = await Artist.findOne({ name });
    res.json({ artist: name, votes: a?.votes || 0 });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch votes" });
  }
});

// POST /votes/upvote  { artist }
router.post("/upvote", async (req, res) => {
  try {
    const name = (req.body?.artist || "").trim();
    if (!name) return res.status(400).json({ error: "artist required" });
    const a = await Artist.findOneAndUpdate(
      { name },
      { $inc: { votes: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ artist: a.name, votes: a.votes });
  } catch (e) {
    res.status(500).json({ error: "Failed to upvote" });
  }
});

module.exports = router;