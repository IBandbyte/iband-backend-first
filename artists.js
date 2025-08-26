const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

// Artist Schema
const artistSchema = new mongoose.Schema({
  name: String,
  genre: String,
  image: String,
  votes: { type: Number, default: 0 }
});

// Artist Model
const Artist = mongoose.model("Artist", artistSchema);

// GET all artists
router.get("/", async (req, res) => {
  try {
    const artists = await Artist.find();
    res.json(artists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add new artist
router.post("/", async (req, res) => {
  try {
    const artist = new Artist(req.body);
    await artist.save();
    res.status(201).json(artist);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST vote for artist
router.post("/:id/vote", async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);
    if (!artist) return res.status(404).json({ error: "Artist not found" });

    artist.votes += 1;
    await artist.save();
    res.json({ message: "Vote added", artist });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;