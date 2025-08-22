// admin.js — secure only (no dedupe, no open seed)

const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// Reuse model if it already exists (avoids OverwriteModelError on hot reloads)
const Artist =
  mongoose.models.Artist ||
  mongoose.model(
    "Artist",
    new mongoose.Schema(
      {
        name: { type: String, required: true, trim: true },
        bio: { type: String, default: "" },
        imageUrl: { type: String, default: "" },
        votes: { type: Number, default: 0 },
      },
      { timestamps: true }
    )
  );

// --- middleware: require x-admin-key header ---
function checkAdminKey(req, res, next) {
  const key = req.header("x-admin-key");
  if (!process.env.ADMIN_KEY) {
    return res.status(500).json({ error: "ADMIN_KEY not set on server" });
  }
  if (key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// --- secure seed (optional – leave for admin use only) ---
router.post("/seed", checkAdminKey, async (_req, res) => {
  const sample = [
    { name: "Aria Nova", bio: "Indie pop vocalist" },
    { name: "Neon Harbor", bio: "Synthwave duo" },
    { name: "Stone & Sparrow", bio: "Folk rock band" },
  ];

  try {
    const out = await Artist.insertMany(sample);
    res.json({ ok: true, inserted: out ? out.length : 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;