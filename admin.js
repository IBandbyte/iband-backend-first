// admin.js — secure only (with dedupe route)
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// Model (reuse if it already exists)
const Artist =
  mongoose.models.Artist ||
  mongoose.model(
    "Artist",
    new mongoose.Schema(
      {
        name: { type: String, required: true },
        bio: { type: String, default: "" },
        imageUrl: { type: String, default: "" },
        votes: { type: Number, default: 0 },
      },
      { timestamps: true }
    )
  );

// Middleware: check admin key
function checkAdminKey(req, res, next) {
  const key = req.header("x-admin-key");
  if (!process.env.ADMIN_KEY) {
    return res.status(500).json({ error: "ADMIN_KEY not set" });
  }
  if (key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// SECURE SEED — requires header x-admin-key
router.post("/seed", checkAdminKey, async (_req, res) => {
  const sample = [
    { name: "Neon Harbor" },
    { name: "Stone & Sparrow" },
    { name: "Aria Nova" },
  ];
  try {
    await Artist.insertMany(sample);
    res.json({ ok: true, inserted: sample.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ONE-TIME DEDUPE — remove duplicate artists by name
router.post("/dedupe", checkAdminKey, async (_req, res) => {
  try {
    const all = await Artist.find();
    const seen = new Set();
    let removed = 0;

    for (const artist of all) {
      if (seen.has(artist.name)) {
        await Artist.deleteOne({ _id: artist._id });
        removed++;
      } else {
        seen.add(artist.name);
      }
    }

    res.json({ ok: true, removedTotal: removed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;