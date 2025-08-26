// admin.js — secure admin endpoints (one-time backfill for `genre`)

const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// Reuse model
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
      },
      { timestamps: true }
    )
  );

// Simple admin-key middleware
function checkAdminKey(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (!process.env.ADMIN_KEY) {
    return res.status(500).json({ error: "ADMIN_KEY not configured" });
  }
  if (key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// POST /admin/backfill-genres
// One-time helper to set genres on existing docs
router.post("/backfill-genres", checkAdminKey, async (_req, res) => {
  // Map your current artist names -> desired genres
  const desired = new Map([
    ["Stone & Sparrow", "Indie Folk"],
    ["Neon Harbor", "Synthwave"],
    ["Aria Nova", "Pop"],
  ]);

  try {
    let matched = 0;
    let updated = 0;

    for (const [name, genre] of desired.entries()) {
      const doc = await Artist.findOne({ name });
      if (doc) {
        matched++;
        if (!doc.genre || doc.genre === "No genre set") {
          doc.genre = genre;
          await doc.save();
          updated++;
        }
      }
    }

    res.json({ ok: true, matched, updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// (No other admin routes right now)
module.exports = router;