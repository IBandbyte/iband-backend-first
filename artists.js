// artists.js — iBand backend router (list + vote + comments)

const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

/* ---------- Schema / Model ---------- */
const commentSchema = new mongoose.Schema(
  {
    name: { type: String, default: "Anon" },
    text: { type: String, required: true },
  },
  { _id: false, timestamps: true }
);

const artistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    genre: { type: String, default: "No genre set" },
    bio: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    votes: { type: Number, default: 0 },
    // Keep an array so we can show real comments later
    comments: { type: [commentSchema], default: [] },
    // Also keep a quick counter for fast list rendering
    commentsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// keep model hot-reload safe
const Artist =
  mongoose.models.Artist || mongoose.model("Artist", artistSchema);

// maintain commentsCount automatically
artistSchema.pre("save", function (next) {
  this.commentsCount = Array.isArray(this.comments) ? this.comments.length : 0;
  next();
});

/* ---------- Helpers ---------- */
const leanArtist = (doc) => {
  const a = doc.toObject ? doc.toObject() : doc;
  // ensure commentsCount is always present and numeric
  a.commentsCount = Array.isArray(a.comments) ? a.comments.length : (a.commentsCount || 0);
  return a;
};

/* ---------- Routes ---------- */

// GET /artists -> list (sorted by name)
router.get("/", async (_req, res) => {
  try {
    const artists = await Artist.find({}).sort({ name: 1 }).lean();
    const data = artists.map((a) => ({
      ...a,
      commentsCount:
        Array.isArray(a.comments) ? a.comments.length : (a.commentsCount || 0),
    }));
    res.json(data);
  } catch (err) {
    console.error("GET /artists error:", err);
    res.status(500).json({ error: "Failed to fetch artists" });
  }
});

// POST /artists/:id/vote -> increment votes
router.post("/:id/vote", async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Artist.findByIdAndUpdate(
      id,
      { $inc: { votes: 1 } },
      { new: true }
    ).lean();
    if (!doc) return res.status(404).json({ error: "Artist not found" });
    res.json({ ok: true, votes: doc.votes });
  } catch (err) {
    console.error("POST /artists/:id/vote error:", err);
    res.status(500).json({ error: "Failed to vote" });
  }
});

// GET /artists/:id/comments -> list comments (newest first)
router.get("/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Artist.findById(id).select("comments").lean();
    if (!doc) return res.status(404).json({ error: "Artist not found" });
    const comments = (doc.comments || []).slice().reverse();
    res.json({ ok: true, comments, count: comments.length });
  } catch (err) {
    console.error("GET /artists/:id/comments error:", err);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// POST /artists/:id/comments -> add comment
router.post("/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const name = (req.body?.name || "Anon").toString().trim().slice(0, 60) || "Anon";
    const text = (req.body?.text || "").toString().trim();

    if (!text) return res.status(400).json({ error: "Comment text required" });

    const doc = await Artist.findById(id);
    if (!doc) return res.status(404).json({ error: "Artist not found" });

    doc.comments.push({ name, text });
    doc.commentsCount = doc.comments.length; // keep in sync
    await doc.save();

    res.json({ ok: true, count: doc.commentsCount });
  } catch (err) {
    console.error("POST /artists/:id/comments error:", err);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

module.exports = router;