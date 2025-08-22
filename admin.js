// admin.js — final clean version (no seed, no dedupe)

const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// Reuse model if it already exists (avoids OverwriteModelError on hot reloads)
const Artist =
  mongoose.models.Artist ||
  mongoose.model(
    "Artist",
    new mongoose.Schema(
      {
        name: { type: String, required: true, trim: true },
        bio: { type: String, default: "" },
        imageUrl: { type: String, default: "" },
        votes: { type: Number, default: 0 },
      },
      { timestamps: true }
    )
  );

// No routes here — admin is now locked down

module.exports = router;