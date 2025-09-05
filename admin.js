// admin.js — guarded admin endpoints (cleanup, health) — model included here
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// Reuse/define Artist model (same schema as artists.js)
const Artist =
  mongoose.models.Artist ||
  mongoose.model(
    "Artist",
    new mongoose.Schema(
      {
        name: { type: String, required: true, trim: true },
        genre: { type: String, default: "No genre set", trim: true },
        bio: { type: String, default: "" },
        imageUrl: { type: String, default: "" },
        votes: { type: Number, default: 0 },
      },
      { timestamps: true }
    )
  );

// Guard all admin routes with ADMIN_KEY
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

// GET /admin/health
router.get("/health", (_req, res) => res.json({ ok: true, route: "admin/health" }));

// POST /admin/cleanup — remove bad names & dedupe by name (keep first)
router.post("/cleanup", async (_req, res) => {
  try {
    // 1) remove invalid/blank names
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

    let removedDupes = 0;
    if (toDelete.length) {
      const result = await Artist.deleteMany({ _id: { $in: toDelete } });
      removedDupes = result.deletedCount || 0;
    }

    res.json({
      ok: true,
      removedBadNames: bad.deletedCount || 0,
      removedDuplicates: removedDupes,
    });
  } catch (err) {
    console.error("Cleanup failed:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;