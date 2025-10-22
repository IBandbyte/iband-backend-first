// comments.js — per-artist comments API
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// --- Schemas (reuse if already defined elsewhere) ---
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

const Comment =
  mongoose.models.Comment ||
  mongoose.model(
    "Comment",
    new mongoose.Schema(
      {
        artistId: { type: mongoose.Schema.Types.ObjectId, ref: "Artist", index: true, required: true },
        artistName: { type: String, required: true }, // denormalized for convenience
        text: { type: String, required: true },
      },
      { timestamps: true }
    )
  );

// health for this module (optional)
router.get("/health", (_req, res) =>
  res.json({ ok: true, service: "comments", ts: new Date().toISOString() })
);

/**
 * GET /comments/:artistId
 * Returns newest → oldest (max 100)
 */
router.get("/:artistId", async (req, res) => {
  try {
    const { artistId } = req.params;
    if (!mongoose.isValidObjectId(artistId)) {
      return res.status(400).json({ error: "Invalid artistId" });
    }
    const list = await Comment.find({ artistId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(list);
  } catch (err) {
    console.error("GET /comments/:artistId", err);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

/**
 * POST /comments/:artistId
 * Body: { text: "your comment" }
 * Creates a comment and bumps the artist.commentsCount
 */
router.post("/:artistId", async (req, res) => {
  try {
    const { artistId } = req.params;
    if (!mongoose.isValidObjectId(artistId)) {
      return res.status(400).json({ error: "Invalid artistId" });
    }
    const { text } = req.body || {};
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "text required" });
    }

    const artist = await Artist.findById(artistId);
    if (!artist) return res.status(404).json({ error: "Artist not found" });

    const comment = await Comment.create({
      artistId,
      artistName: artist.name,
      text: text.trim(),
    });

    // increment denormalized counter (safe & atomic)
    await Artist.updateOne({ _id: artistId }, { $inc: { commentsCount: 1 } });

    res.status(201).json({
      id: comment._id,
      artistId,
      artistName: artist.name,
      text: comment.text,
      createdAt: comment.createdAt,
      commentsCount: (artist.commentsCount ?? 0) + 1,
    });
  } catch (err) {
    console.error("POST /comments/:artistId", err);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

module.exports = router;