// admin.js — iBand backend admin routes (cleanup included)
const express = require("express");
const router = express.Router();
const Artist = require("./models/artist");

// ---- Guard all admin routes with ADMIN_KEY env var
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

// Simple health check
router.get("/health", (_req, res) => {
  res.json({ ok: true, route: "admin/health" });
});

// ---- ONE-TIME CLEANUP ----
// Deletes blank/invalid names and deduplicates by name (keeps the first)
router.post("/cleanup", async (_req, res) => {
  try {
    // 1) delete bad names
    const bad = await Artist.deleteMany({
      $or: [
        { name: null },
        { name: "" },
        { name: "undefined" },
        { name: { $exists: false } }
      ],
    });

    // 2) dedupe by normalized name
    const all = await Artist.find({}, { _id: 1, name: 1, genre: 1 }).lean();
    const seen = new Set();
    const toDelete = [];

    for (const a of all) {
      const norm = (a.name || "").trim().toLowerCase();
      if (!norm) continue;
      if (seen.has(norm)) toDelete.push(a._id);
      else seen.add(norm);
    }

    let dedup = { deletedCount: 0 };
    if (toDelete.length) {
      const result = await Artist.deleteMany({ _id: { $in: toDelete } });
      dedup.deletedCount = result.deletedCount || 0;
    }

    res.json({
      ok: true,
      removedBadNames: bad.deletedCount || 0,
      removedDuplicates: dedup.deletedCount || 0,
    });
  } catch (err) {
    console.error("Cleanup failed:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;