// admin.js
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const ADMIN_KEY = process.env.ADMIN_KEY || "";

// Reuse the Artist model that artists.js already registered.
let Artist;
try { Artist = mongoose.model("Artist"); }
catch { throw new Error("Artist model not registered. Ensure artists.js runs before admin.js"); }

// --- helpers ---
function requireAdmin(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    return res.status(403).json({ error: "Forbidden (bad or missing x-admin-key)" });
  }
  next();
}

function normalizeName(name = "") {
  return (name || "").trim().toLowerCase();
}

function pickRicher(a, b) {
  // choose the artist doc that has more/better data
  const score = (x) => {
    let s = 0;
    if (x.bio && x.bio.trim()) s += 2;
    if (x.imageUrl && x.imageUrl.trim()) s += 2;
    if (x.genre && x.genre.trim() && x.genre !== "No genre set") s += 1;
    if (typeof x.votes === "number") s += Math.min(3, Math.max(0, x.votes / 10)); // tiny weight
    return s;
  };
  return score(a) >= score(b) ? a : b;
}

function mergedDoc(keep, remove) {
  // Combine the best of both
  const out = keep.toObject();
  // Prefer non-empty fields from either
  if ((!out.imageUrl || !out.imageUrl.trim()) && remove.imageUrl) out.imageUrl = remove.imageUrl;
  if ((!out.bio || !out.bio.trim()) && remove.bio) out.bio = remove.bio;
  if ((!out.genre || out.genre === "No genre set") && remove.genre && remove.genre !== "No genre set") {
    out.genre = remove.genre;
  }
  // Sum numeric counters if present
  const votesA = typeof out.votes === "number" ? out.votes : 0;
  const votesB = typeof remove.votes === "number" ? remove.votes : 0;
  out.votes = votesA + votesB;

  const cA = typeof out.commentsCount === "number" ? out.commentsCount : 0;
  const cB = typeof remove.commentsCount === "number" ? remove.commentsCount : 0;
  out.commentsCount = cA + cB;

  return out;
}

// --- routes ---

// Preview: find duplicate groups without changing anything
router.get("/report", requireAdmin, async (_req, res) => {
  const all = await Artist.find({}).lean();
  const map = new Map();
  for (const a of all) {
    const k = normalizeName(a.name);
    if (!k) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(a);
  }
  const dups = [];
  for (const [k, arr] of map) {
    if (arr.length > 1) dups.push({ name: k, count: arr.length, ids: arr.map(x => x._id) });
  }
  res.json({ total: all.length, duplicateGroups: dups.length, groups: dups });
});

// Dedupe + merge: keeps the richest doc per name, merges others into it, deletes extras
router.post("/cleanup", requireAdmin, async (req, res) => {
  const all = await Artist.find({});
  const byName = new Map();
  for (const doc of all) {
    const key = normalizeName(doc.name);
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(doc);
  }

  let merged = 0;
  let deleted = 0;

  for (const [, group] of byName) {
    if (group.length < 2) continue;

    // choose keeper
    let keep = group[0];
    for (let i = 1; i < group.length; i++) keep = pickRicher(keep, group[i]);

    // merge everyone else into keep
    for (const doc of group) {
      if (String(doc._id) === String(keep._id)) continue;
      const out = mergedDoc(keep, doc);
      await Artist.updateOne({ _id: keep._id }, out);
      await Artist.deleteOne({ _id: doc._id });
      merged++;
      deleted++;
    }
  }

  // Optional: trim empties (missing name)
  const emptyGone = (await Artist.deleteMany({ $or: [{ name: { $exists: false } }, { name: "" }] })).deletedCount;

  res.json({ ok: true, merged, deleted, emptyRemoved: emptyGone });
});

// Hard reset: delete ALL artists
router.post("/reset", requireAdmin, async (_req, res) => {
  const { deletedCount } = await Artist.deleteMany({});
  res.json({ ok: true, deletedCount });
});

// Seed some nice demo artists again
router.post("/seed", requireAdmin, async (_req, res) => {
  const demoArtists = [
    {
      name: "Aria Nova",
      genre: "Pop",
      bio: "Rising star blending electro-pop with dreamy vocals.",
      imageUrl: "https://i.imgur.com/XYZ123a.jpg",
      votes: 12,
      commentsCount: 3,
    },
    {
      name: "Neon Harbor",
      genre: "Synthwave",
      bio: "Retro-futuristic vibes, heavy synth, 80s nostalgia.",
      imageUrl: "https://i.imgur.com/XYZ123b.jpg",
      votes: 8,
      commentsCount: 1,
    },
    {
      name: "Stone & Sparrow",
      genre: "Indie Folk",
      bio: "Acoustic harmonies, storytelling, and soulful strings.",
      imageUrl: "https://i.imgur.com/XYZ123c.jpg",
      votes: 20,
      commentsCount: 5,
    },
  ];
  await Artist.insertMany(demoArtists);
  res.json({ ok: true, seeded: demoArtists.length });
});

module.exports = router;