// artists.js
// Public Artists API for iBand backend
// Uses shared in-memory artistsStore (no external DB yet).

const express = require("express");
const router = express.Router();

const {
  getAllArtists,
  getArtistById,
  createArtist,
  updateArtist,
  deleteArtist,
} = require("./artistsStore");

// GET /api/artists
// List all artists
router.get("/", (req, res) => {
  const artists = getAllArtists();
  res.json({
    success: true,
    count: artists.length,
    artists,
  });
});

// GET /api/artists/:id
// Fetch single artist by ID
router.get("/:id", (req, res) => {
  const id = req.params.id;
  const artist = getArtistById(id);

  if (!artist) {
    return res.status(404).json({
      success: false,
      message: "Artist not found.",
    });
  }

  res.json({
    success: true,
    artist,
  });
});

// POST /api/artists
// Create a new artist (public friendly)
router.post("/", (req, res) => {
  const { name, genre, bio, imageUrl } = req.body || {};

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: "Name is required.",
    });
  }

  const artist = createArtist({ name, genre, bio, imageUrl });

  res.status(201).json({
    success: true,
    artist,
  });
});

// PUT /api/artists/:id
// Full update (replace fields)
router.put("/:id", (req, res) => {
  const id = req.params.id;
  const { name, genre, bio, imageUrl } = req.body || {};

  const updated = updateArtist(id, { name, genre, bio, imageUrl });

  if (!updated) {
    return res.status(404).json({
      success: false,
      message: "Artist not found.",
    });
  }

  res.json({
    success: true,
    artist: updated,
  });
});

// PATCH /api/artists/:id
// Partial update
router.patch("/:id", (req, res) => {
  const id = req.params.id;
  const patch = req.body || {};

  const updated = updateArtist(id, patch);

  if (!updated) {
    return res.status(404).json({
      success: false,
      message: "Artist not found.",
    });
  }

  res.json({
    success: true,
    artist: updated,
  });
});

// DELETE /api/artists/:id
// Remove artist
router.delete("/:id", (req, res) => {
  const id = req.params.id;

  const removed = deleteArtist(id);

  if (!removed) {
    return res.status(404).json({
      success: false,
      message: "Artist not found.",
    });
  }

  res.json({
    success: true,
    message: "Artist deleted.",
  });
});

module.exports = router;