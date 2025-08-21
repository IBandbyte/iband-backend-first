// admin.js — secure only (no seed-open)

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

// SECURE SEED — requires header x-admin-key to match process.env.ADMIN_KEY
router.post("/seed", (req, res, next) => {
  const key = req.header("x-admin-key");
  if (!process.env.ADMIN_KEY) {
    return res.status(500).json({ error: "ADMIN_KEY not set" });
  }
  if (key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}, async (_req, res) => {
  const sample = [
    { name: "Aria Nova", bio: "Indie pop vocal" },
    { name: "Neon Harbor", bio: "Synthwave duo" },
    { name: "Stone & Sparrow", bio: "Folk rock" },
  ];
  const out = await Artist.insertMany(sample);
  res.json({ ok: true, inserted: out.length });
});

// List artists (read-only)
router.get("/artists", async (_req, res) => {
  const items = await Artist.find().sort({ createdAt: -1 });
  res.json(items);
});

module.exports = router;