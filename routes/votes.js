/* eslint-env node */

// routes/votes.js — lightweight votes API under /api/votes
// Works alongside artists.js which stores the tally on each Artist doc.

const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// Minimal Artist model (matches the collection used by artists.js)
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
      { collection: "artists", timestamps: false }
    )
  );

/**
 * GET /api/votes
 * Returns an array of { artistId, votes }
 */
router.get("/", async (_req, res) => {
  try {
    const rows = await Artist.find({}, { votes: 1 }).lean();
    const out = rows.map((r) => ({ artistId: String(r._id), votes: r.votes || 0 }));
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: "Failed to read votes" });
  }
});

/**
 * GET /api/votes/:artistId
 * Returns { artistId, votes }
 */
router.get("/:artistId", async (req, res) => {
  try {
    const { artistId } = req.params;
    if (!mongoose.isValidObjectId(artistId)) {
      return res.status(400).json({ error: "Invalid artistId" });
    }
    const a = await Artist.findById(artistId, { votes: 1 }).lean();
    if (!a) return res.status(404).json({ error: "Artist not found" });
    res.json({ artistId, votes: a.votes || 0 });
  } catch (_e) {
    res.status(500).json({ error: "Failed to read vote" });
  }
});

/**
 * POST /api/votes
 * Body: { artistId, delta }   // delta = +1 or -1
 * Returns { artistId, votes }
 */
router.post("/", async (req, res) => {
  try {
    const { artistId, delta } = req.body || {};
    if (!artistId || !mongoose.isValidObjectId(artistId)) {
      return res.status(400).json({ error: "artistId required" });
    }
    const n = Number(delta);
    if (![1, -1].includes(n)) {
      return res.status(400).json({ error: "delta must be +1 or -1" });
    }

    const updated = await Artist.findByIdAndUpdate(
      artistId,
      { $inc: { votes: n } },
      { new: true, projection: { votes: 1 } }
    ).lean();

    if (!updated) return res.status(404).json({ error: "Artist not found" });

    res.status(200).json({ artistId, votes: updated.votes || 0 });
  } catch (_e) {
    res.status(500).json({ error: "Failed to update vote" });
  }
});

module.exports = router;