// artists.js
const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

// --- Schema / Model ---
const artistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    genre: { type: String, default: "No genre set" },
    bio: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    votes: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Artist = mongoose.models.Artist || mongoose.model("Artist", artistSchema);

// --- GET all (sorted by name) ---
router.get("/", async (_req, res) => {
  try {
    const artists = await Artist.find({}).sort({ name: 1 });
    res.json(artists);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch artists" });
  }
});

// --- GET one by id ---
router.get("/:id", async (req, res) => {
  try {
    const a = await Artist.findById(req.params.id);
    if (!a) return res.status(404).json({ error: "Not found" });
    res.json(a);
  } catch {
    res.status(400).json({ error: "Invalid id" });
  }
});

// --- POST create ---
router.post("/", async (req, res) => {
  try {
    const a = await Artist.create(req.body || {});
    res.status(201).json(a);
  } catch (err) {
    res.status(400).json({ error: err.message || "Bad request" });
  }
});

// --- PUT update ---
router.put("/:id", async (req, res) => {
  try {
    const a = await Artist.findByIdAndUpdate(req.params.id, req.body || {}, { new: true });
    if (!a) return res.status(404).json({ error: "Not found" });
    res.json(a);
  } catch {
    res.status(400).json({ error: "Invalid id" });
  }
});

// --- DELETE remove ---
router.delete("/:id", async (req, res) => {
  try {
    const r = await Artist.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "Invalid id" });
  }
});

// --- POST vote (⬆️ increment) ---
router.post("/:id/vote", async (req, res) => {
  try {
    const a = await Artist.findByIdAndUpdate(
      req.params.id,
      { $inc: { votes: 1 } },
      { new: true }
    );
    if (!a) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true, votes: a.votes, _id: a._id });
  } catch {
    res.status(400).json({ error: "Invalid id" });
  }
});

module.exports = router;