// routes/votes.js
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// Re-use existing Artist model if present, otherwise define a minimal schema.
const Artist =
  mongoose.models.Artist ||
  mongoose.model(
    "Artist",
    new mongoose.Schema(
      {
        name: String,
        genre: String,
        votes: { type: Number, default: 0 },
        commentsCount: { type: Number, default: 0 },
      },
      { timestamps: true }
    )
  );

// GET /votes -> list all artists with vote counts (descending)
router.get("/votes", async (_req, res) => {
  try {
    const rows = await Artist.find({}, { name: 1, votes: 1 })
      .sort({ votes: -1 })
      .lean();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch votes" });
  }
});

// GET /votes/:id -> single artist's votes
router.get("/votes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const a = await Artist.findById(id, { name: 1, votes: 1 }).lean();
    if (!a) return res.status(404).json({ error: "Artist not found" });
    res.json(a);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch votes" });
  }
});

// POST /artists/:id/vote -> increment votes counter
router.post("/artists/:id/vote", async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Artist.findByIdAndUpdate(
      id,
      { $inc: { votes: 1 } },
      { new: true, projection: { votes: 1 } }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Artist not found" });
    res.json({ ok: true, votes: updated.votes });
  } catch (e) {
    res.status(500).json({ error: "Failed to register vote" });
  }
});

module.exports = router;