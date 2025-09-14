// admin.js — ALL admin routes secured by ADMIN_KEY header
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Artist = mongoose.models.Artist;

// --- Guard all admin routes ---
router.use((req, res, next) => {
  const key = req.header("x-admin-key");
  if (!process.env.ADMIN_KEY) {
    return res.status(500).json({ error: "ADMIN_KEY not set on server" });
  }
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

// Simple health
router.get("/health", (_req, res) => {
  res.json({ ok: true, route: "admin/health" });
});

// --- ONE-TIME CLEANUP ---
// Deletes blank/invalid names and deduplicates by normalized name
router.post("/cleanup", async (_req, res) => {
  try {
    // 1) remove bad/empty names
    const bad = await Artist.deleteMany({
      $or: [
        { name: null },
        { name: "" },
        { name: "undefined" },
        { name: { $exists: false } },
      ],
    });

    // 2) dedupe by normalized name
    const all = await Artist.find({}, { _id: 1, name: 1 }).lean();
    const seen = new Set();
    const toDelete = [];

    for (const a of all) {
      const norm = (a.name || "").trim().toLowerCase();
      if (!norm) continue;
      if (seen.has(norm)) toDelete.push(a._id);
      else seen.add(norm);
    }

    let dedupDeleted = 0;
    if (toDelete.length) {
      const result = await Artist.deleteMany({ _id: { $in: toDelete } });
      dedupDeleted = result.deletedCount || 0;
    }

    res.json({
      ok: true,
      removedBadNames: bad.deletedCount || 0,
      removedDuplicates: dedupDeleted,
    });
  } catch (err) {
    console.error("Cleanup failed:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Seed with reliable images ---
router.post("/seed-demo", async (_req, res) => {
  try {
    const demoArtists = [
      {
        name: "Aria Nova",
        genre: "Pop",
        bio: "Rising star blending electro-pop with dreamy vocals.",
        imageUrl: "https://picsum.photos/seed/aria/300/300",
        votes: 12,
        commentsCount: 3,
      },
      {
        name: "Neon Harbor",
        genre: "Synthwave",
        bio: "Retro-futuristic vibes, heavy synth, 80s nostalgia.",
        imageUrl: "https://picsum.photos/seed/neon/300/300",
        votes: 8,
        commentsCount: 1,
      },
      {
        name: "Stone & Sparrow",
        genre: "Indie Folk",
        bio: "Acoustic harmonies, storytelling, and soulful strings.",
        imageUrl: "https://picsum.photos/seed/sparrow/300/300",
        votes: 20,
        commentsCount: 5,
      },
    ];

    await Artist.insertMany(demoArtists);
    res.json({ message: "✅ Demo artists seeded (with images)", count: demoArtists.length });
  } catch (err) {
    console.error("Seeding failed:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;