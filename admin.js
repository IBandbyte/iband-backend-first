// admin.js — admin routes: health, cleanup, seed-demo (with working images)
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

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
        commentsCount: { type: Number, default: 0 },
      },
      { timestamps: true }
    )
  );

// ---- Admin guard (for POST routes) ----
function requireAdmin(req, res, next) {
  const key = req.header("x-admin-key");
  if (!process.env.ADMIN_KEY) {
    return res.status(500).json({ error: "ADMIN_KEY not set on server" });
  }
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

// Public health for admin namespace
router.get("/health", (_req, res) => {
  res.json({ ok: true, route: "admin/health" });
});

// ---- Cleanup (as before) ----
router.post("/cleanup", requireAdmin, async (_req, res) => {
  try {
    const bad = await Artist.deleteMany({
      $or: [
        { name: null },
        { name: "" },
        { name: "undefined" },
        { name: { $exists: false } },
      ],
    });

    const all = await Artist.find({}, { _id: 1, name: 1 }).lean();
    const seen = new Set();
    const dupes = [];
    for (const a of all) {
      const n = (a.name || "").trim().toLowerCase();
      if (!n) continue;
      if (seen.has(n)) dupes.push(a._id);
      else seen.add(n);
    }
    let dedupCount = 0;
    if (dupes.length) {
      const r = await Artist.deleteMany({ _id: { $in: dupes } });
      dedupCount = r.deletedCount || 0;
    }
    res.json({
      ok: true,
      removedBadNames: bad.deletedCount || 0,
      removedDuplicates: dedupCount,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---- Seed data with guaranteed-working images ----
// We use picsum.photos (always available) with different seeds
function seedArray() {
  return [
    {
      name: "Aria Nova",
      genre: "Pop",
      bio: "Rising star blending electro-pop with dreamy vocals.",
      imageUrl: "https://picsum.photos/seed/aria-nova/200",
      votes: 12,
      commentsCount: 3,
    },
    {
      name: "Neon Harbor",
      genre: "Synthwave",
      bio: "Retro-futuristic vibes, heavy synth, 80s nostalgia.",
      imageUrl: "https://picsum.photos/seed/neon-harbor/200",
      votes: 8,
      commentsCount: 1,
    },
    {
      name: "Stone & Sparrow",
      genre: "Indie Folk",
      bio: "Acoustic harmonies, storytelling, and soulful strings.",
      imageUrl: "https://picsum.photos/seed/stone-sparrow/200",
      votes: 20,
      commentsCount: 5,
    },
  ];
}

// Handy preview (no auth, no writes) so you can tap this in a browser:
router.get("/seed-preview", (_req, res) => {
  res.json({ ok: true, sample: seedArray() });
});

// Actual write (auth required): deletes existing by name, then inserts fresh
router.post("/seed-demo", requireAdmin, async (_req, res) => {
  try {
    const items = seedArray();
    const names = items.map((i) => i.name);
    await Artist.deleteMany({ name: { $in: names } });
    const inserted = await Artist.insertMany(items);
    res.json({ message: "✅ Demo artists seeded (with images)", count: inserted.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;