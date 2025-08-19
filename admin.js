const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Artist = mongoose.models.Artist || mongoose.model(
  "Artist",
  new mongoose.Schema(
    {
      name: { type: String, required: true, trim: true },
      bio: { type: String, default: "" },
      imageUrl: { type: String, default: "" },
      votes: { type: Number, default: 0 }
    },
    { timestamps: true }
  )
);

// (A) Secure seed (uses ADMIN_KEY header) — keep for later
router.post("/seed", (req, res, next) => {
  const key = req.header("x-admin-key");
  if (!process.env.ADMIN_KEY) return res.status(500).json({ error: "ADMIN_KEY not set" });
  if (key !== process.env.ADMIN_KEY) return res.status(401).json({ error: "Unauthorized" });
  next();
}, async (_req, res) => {
  const sample = [
    { name: "Aria Nova", bio: "Indie pop vocalist", imageUrl: "" },
    { name: "Neon Harbor", bio: "Synthwave duo", imageUrl: "" },
    { name: "Stone & Sparrow", bio: "Folk rock band", imageUrl: "" }
  ];
  const out = await Artist.insertMany(sample, { ordered: false }).catch(() => null);
  res.json({ ok: true, inserted: out ? out.length : "maybe already inserted" });
});

// (B) ONE-TIME OPEN seed (no key) — use now, remove later
router.get("/seed-open", async (_req, res) => {
  const sample = [
    { name: "Aria Nova", bio: "Indie pop vocalist", imageUrl: "" },
    { name: "Neon Harbor", bio: "Synthwave duo", imageUrl: "" },
    { name: "Stone & Sparrow", bio: "Folk rock band", imageUrl: "" }
  ];
  try {
    const out = await Artist.insertMany(sample, { ordered: false });
    res.json({ ok: true, inserted: out.length });
  } catch (e) {
    // Likely duplicates if you ran it already
    res.json({ ok: true, note: "seed likely already done" });
  }
});

module.exports = router;