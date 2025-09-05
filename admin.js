// admin.js — iBand backend admin routes
const express = require("express");
const router = express.Router();
const Artist = require("./models/artist");

// Guard: all admin endpoints require ADMIN_KEY
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

// quick health for admin scope
router.get("/health", (_req, res) => {
  res.json({ ok: true, route: "admin/health" });
});

// ONE-TIME CLEANUP
// 1) remove bad/blank names  2) dedupe by normalized name
router.post("/cleanup", async (_req, res) => {
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
    const toDelete = [];

    for (const a of all) {
      const norm = (a.name || "").trim().toLowerCase();
      if (!norm) continue;
      if (seen.has(norm)) toDelete.push(a._id);
      else seen.add(norm);
    }

    let removedDuplicates = 0;
    if (toDelete.length) {
      const r = await Artist.deleteMany({ _id: { $in: toDelete } });
      removedDuplicates = r.deletedCount || 0;
    }

    res.json({
      ok: true,
      removedBadNames: bad.deletedCount || 0,
      removedDuplicates,
    });
  } catch (err) {
    console.error("Cleanup failed:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;