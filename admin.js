// admin.js — iBand backend admin routes
const express = require("express");
const router = express.Router();
const Artist = require("./models/artist");

// Secure with ADMIN_KEY
router.use((req, res, next) => {
  const key = req.header("x-admin-key");
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

// --- Test route
router.get("/health", (_req, res) => {
  res.json({ status: "admin routes live" });
});

// --- Cleanup route: removes blanks + dedupes
router.post("/cleanup", async (_req, res) => {
  try {
    // 1. Delete blank/undefined names
    await Artist.deleteMany({
      $or: [{ name: null }, { name: "" }, { name: "undefined" }],
    });

    // 2. Deduplicate by name (keep first)
    const artists = await Artist.find({});
    const seen = new Set();
    for (const artist of artists) {
      if (seen.has(artist.name)) {
        await Artist.deleteOne({ _id: artist._id });
      } else {
        seen.add(artist.name);
      }
    }

    res.json({ success: true, message: "Cleanup done ✅" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Cleanup failed" });
  }
});

module.exports = router;