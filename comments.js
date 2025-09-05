// comments.js — very small comments API (flat)
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Comment =
  mongoose.models.Comment ||
  mongoose.model(
    "Comment",
    new mongoose.Schema(
      {
        artistName: { type: String, required: true },
        text: { type: String, required: true },
      },
      { timestamps: true }
    )
  );

// GET /comments?artist=Aria%20Nova
router.get("/", async (req, res) => {
  try {
    const q = {};
    if (req.query.artist) q.artistName = req.query.artist;
    const list = await Comment.find(q).sort({ createdAt: -1 }).limit(100);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// POST /comments  { artistName, text }
router.post("/", async (req, res) => {
  try {
    const { artistName, text } = req.body || {};
    if (!artistName || !text) return res.status(400).json({ error: "artistName and text required" });
    const c = await Comment.create({ artistName, text });
    res.status(201).json(c);
  } catch (e) {
    res.status(500).json({ error: "Failed to add comment" });
  }
});

module.exports = router;