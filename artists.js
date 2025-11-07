/* eslint-env node */

// artists.js — artist listing + single fetch + vote endpoint (robust to string IDs)

const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

/* ------------------------------------------------------------------ */
/* Model (kept minimal; uses existing "artists" collection)           */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

// Accept both Mongo ObjectId and plain string IDs that your DB currently uses
function isAcceptableId(id) {
  if (!id || typeof id !== "string") return false;
  // Accept if it is a valid ObjectId OR a non-empty string length >= 8
  return mongoose.isValidObjectId(id) || id.length >= 8;
}

// Defensive parse for bodies coming from mobile/web tools
function coerceNumber(n, fallback = 0) {
  if (typeof n === "number" && Number.isFinite(n)) return n;
  const parsed = Number(n);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/* ------------------------------------------------------------------ */
/* Routes                                                             */
/* ------------------------------------------------------------------ */

// GET /artists — list artists
router.get("/", async (_req, res) => {
  try {
    const list = await Artist.find(
      {},
      { name: 1, genre: 1, votes: 1, commentsCount: 1 }
    )
      .sort({ name: 1 })
      .lean();
    return res.json(list);
  } catch (_e) {
    return res.status(500).json({ error: "Failed to fetch artists" });
  }
});

// GET /artists/:id — fetch single artist
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isAcceptableId(id)) {
      return res.status(400).json({ error: "Invalid artist id" });
    }

    // Works for string _id or ObjectId
    const artist = await Artist.findOne(
      { _id: id },
      { name: 1, genre: 1, votes: 1, commentsCount: 1 }
    ).lean();

    if (!artist) return res.status(404).json({ error: "Artist not found" });
    return res.json(artist);
  } catch (_e) {
    return res.status(500).json({ error: "Failed to fetch artist" });
  }
});

// POST /artists/:id/vote — change vote counter
// Body: { "delta": +1 | -1 }
router.post("/:id/vote", async (req, res) => {
  try {
    const { id } = req.params;
    const n = coerceNumber((req.body || {}).delta, NaN);

    if (!isAcceptableId(id)) {
      return res.status(400).json({ error: "Invalid artist id" });
    }
    if (!(n === 1 || n === -1)) {
      return res.status(400).json({ error: "delta must be +1 or -1" });
    }

    const updated = await Artist.findByIdAndUpdate(
      id,
      { $inc: { votes: n } },
      { new: true, projection: { name: 1, votes: 1 } }
    ).lean();

    if (!updated) return res.status(404).json({ error: "Artist not found" });

    return res.json({
      id: String(updated._id),
      name: updated.name,
      votes: updated.votes || 0,
    });
  } catch (_e) {
    return res.status(500).json({ error: "Failed to update vote" });
  }
});

module.exports = router;