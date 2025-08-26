// artists.js — list artists (now includes `genre`)

const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// Reuse model if it already exists
const Artist =
  mongoose.models.Artist ||
  mongoose.model(
    "Artist",
    new mongoose.Schema(
      {
        name: { type: String, required: true },
        genre: { type: String, default: "No genre set" }, // <-- NEW
        bio: { type: String, default: "" },
        imageUrl: { type: String, default: "" },
        votes: { type: Number, default: 0 },
      },
      { timestamps: true }
    )
  );

// GET /artists — return name + genre (and anything else you want)
router.get("/", async (_req, res) => {
  try {
    const list = await Artist.find({}, { name: 1, genre: 1, _id: 0 }).sort({
      name: 1,
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;