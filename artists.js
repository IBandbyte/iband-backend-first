/* eslint-env node */

// artists.js — iBandbyte Artist API (root-level)
// Full CRUD-ready, vote logic, strong ObjectId validation

const express = require("express");
const mongoose = require("mongoose");
const isObjectId = require("../utils/isObjectId");

const router = express.Router();

/* ----------------------------------------
 * Artist Model
 * -------------------------------------- */
const Artist =
  mongoose.models.Artist ||
  mongoose.model(
    "Artist",
    new mongoose.Schema(
      {
        name: { type: String, required: true, trim: true },
        genre: { type: String, default: "" },
        votes: { type: Number, default: 0 },
        commentsCount: { type: Number, default: 0 },
      },
      { collection: "artists", timestamps: false }
    )
  );

/* ----------------------------------------
 * GET /artists — list all artists
 * -------------------------------------- */
router.get("/", async (_req, res) => {
  try {
    const list = await Artist.find(
      {},
      { name: 1, genre: 1, votes: 1, commentsCount: 1 }
    )
      .sort({ name: 1 })
      .lean();

    return res.json({ ok: true, count: list.length, artists: list });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Failed to fetch artists" });
  }
});

/* ----------------------------------------
 * GET /artists/:id — fetch single artist
 * -------------------------------------- */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  if (!isObjectId(id)) {
    return res.status(400).json({ ok: false, error: "Invalid artist ID" });
  }

  try {
    const artist = await Artist.findById(id).lean();
    if (!artist)
      return res.status(404).json({ ok: false, error: "Artist not found" });

    return res.json({ ok: true, artist });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Fetch failed" });
  }
});

/* ----------------------------------------
 * POST /artists/:id/vote
 * Body: { delta: +1 | -1 }
 * -------------------------------------- */
router.post("/:id/vote", async (req, res) => {
  const { id } = req.params;

  if (!isObjectId(id)) {
    return res.status(400).json({ ok: false, error: "Invalid artist ID" });
  }

  const delta = Number(req.body?.delta);
  if (![1, -1].includes(delta)) {
    return res.status(400).json({ ok: false, error: "delta must be +1 or -1" });
  }

  try {
    const updated = await Artist.findByIdAndUpdate(
      id,
      { $inc: { votes: delta } },
      { new: true }
    ).lean();

    if (!updated)
      return res.status(404).json({ ok: false, error: "Artist not found" });

    return res.json({
      ok: true,
      id,
      name: updated.name,
      votes: updated.votes,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Failed to apply vote" });
  }
});

module.exports = router;