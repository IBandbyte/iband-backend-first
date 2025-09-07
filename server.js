// server.js — iBand backend (artists + admin + extras)
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// -------------------- DB --------------------
const MONGO = process.env.MONGO_URI || process.env.MONGODB_URI;
mongoose
  .connect(MONGO, { /* modern driver: no extra flags needed */ })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// -------------------- Models --------------------
const artistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    genre: { type: String, default: "No genre set" },
    // NEW optional fields for the UI:
    imageUrl: { type: String, default: "" },
    bio: { type: String, default: "" },
    votes: { type: Number, default: 0 },
  },
  { timestamps: true }
);
// Reuse if already compiled
const Artist = mongoose.models.Artist || mongoose.model("Artist", artistSchema);

// -------------------- Health --------------------
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    mongoUriPresent: !!MONGO,
    env: process.env.RENDER ? "render" : "local",
  });
});

// -------------------- Artists --------------------
/**
 * GET /artists
 * Returns: [{ name, genre, imageUrl, bio, votes, commentsCount }]
 * - commentsCount is computed from a separate "comments" collection if present:
 *   documents shaped like: { artist: "<artist name>", ... }
 *   (If the collection/field isn't there, we gracefully return 0.)
 */
app.get("/artists", async (_req, res) => {
  try {
    // 1) Base list (only fields the UI needs)
    const artists = await Artist.find(
      {},
      { _id: 0, name: 1, genre: 1, imageUrl: 1, bio: 1, votes: 1 }
    ).sort({ name: 1 }).lean();

    // 2) Best-effort join: comments count per artist name
    let countsByName = {};
    try {
      const hasDb = mongoose.connection?.db;
      if (hasDb) {
        const collections = await hasDb.listCollections().toArray();
        const hasComments = collections.some(c => c.name === "comments");
        if (hasComments) {
          const grouped = await hasDb
            .collection("comments")
            .aggregate([
              { $match: { artist: { $type: "string" } } },
              { $group: { _id: "$artist", n: { $sum: 1 } } },
            ])
            .toArray();
          for (const g of grouped) countsByName[g._id] = g.n;
        }
      }
    } catch (e) {
      // Don’t fail the request if comments collection/shape is different
      console.warn("commentsCount aggregation skipped:", e.message);
    }

    // 3) Attach counts (fallback 0)
    const payload = artists.map(a => ({
      ...a,
      commentsCount: countsByName[a.name] || 0,
    }));

    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch artists" });
  }
});

// -------------------- Admin: ONE-TIME CLEANUP --------------------
app.post("/admin/cleanup", async (req, res) => {
  try {
    const key = req.headers["x-admin-key"];
    if (key !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Remove bad names
    const bad = await Artist.deleteMany({
      $or: [
        { name: null },
        { name: "" },
        { name: "undefined" },
        { name: { $exists: false } },
      ],
    });

    // Dedupe by normalized name
    const all = await Artist.find({}, { _id: 1, name: 1 }).lean();
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
      const r = await Artist.deleteMany({ _id: { $in: toDelete } });
      dedup.deletedCount = r.deletedCount || 0;
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

// -------------------- Start --------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on :${PORT}`));