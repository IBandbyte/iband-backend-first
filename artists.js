// artists.js — artist schema + public list route
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// --- Schema (re-uses model if hot-reloaded) ---
const artistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    genre: { type: String, default: "No genre set" },
    bio: { type: String, default: "" },
    imageUrl: { type: String, default: "" },  // shown on frontend cards
    votes: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Artist =
  mongoose.models.Artist || mongoose.model("Artist", artistSchema);

// --- GET /artists — return all artists sorted by name ---
router.get("/", async (_req, res) => {
  try {
    const artists = await Artist.find().sort({ name: 1 });
    res.json(artists);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch artists" });
  }
});

module.exports = router;