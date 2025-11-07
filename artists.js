/* eslint-env node */

// artists.js — artist listing + single fetch + simple vote endpoint (hardened)

const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const { Types } = mongoose;

// Model definition (shared shape with votes route)
const Artist =
  mongoose.models.Artist ||
  mongoose.model(
    "Artist",
    new mongoose.Schema(
      {
        name: { type: String, required: true },
        genre: { type: String, default: "" },
        votes: { type: Number, default: 0 },
        commentsCount: { type: Number, default: 0 },
      },
      { collection: "artists", timestamps: false }
    )
  );

// GET /artists — list artists (minimal projection)
router.get("/", async (_req, res) => {
  try {
    const list = await Artist.find(
      {},
      { name: 1, genre: 1, votes: 1, commentsCount: 1 }
    )
      .sort({ name: 1 })
      .lean();
    res.json(list);
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("GET /artists failed:", e);
    }
    res.status(500).json({ error: "Failed to fetch artists" });
  }
});

// GET /artists/:id — fetch single artist (robust to cast/projection issues)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid artist id" });
    }

    const artist = await Artist.findOne(
      { _id: new Types.ObjectId(id) },
      { name: 1, genre: 1, votes: 1, commentsCount: 1 }
    ).lean();

    if (!artist) return res.status(404).json({ error: "Artist not found" });
    return res.json(artist);
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("GET /artists/:id failed:", e);
    }
    return res.status(500).json({ error: "Failed to fetch artist" });
  }
});

// POST /artists/:id/vote — bump vote counter
// Body: { delta: +1 | -1 }
router.post("/:id/vote", async (req, res) => {
  try {
    const { id } = req.params;
    const n = Number((req.body || {}).delta);

    if (!Types.ObjectId.isValid(id)) {
      return