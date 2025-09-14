// artists.js — list artists with image, bio, votes
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Artist =
  mongoose.models.Artist ||
  mongoose.model(
    "Artist",
    new mongoose.Schema(
      {
        name: { type: String, required: true },
        genre: { type: String, default: "No genre set" },
        bio: { type: String, default: "" },
        imageUrl: { type: String, default: "" },
        votes: { type: Number, default: 0 },
        commentsCount: { type: Number, default: 0 },
      },
      { timestamps: true }
    )
  );

// GET /artists — return all fields the UI needs
router.get("/", async (_req, res) => {
  try {
    const list = await Artist.find(
      {},
      { name: 1, genre: 1, bio: 1, imageUrl: 1, votes: 1 }
    ).sort({ name: 1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;