// artists.js
// Public artist API – powered by artistsStore.js

const express = require("express");
const router = express.Router();

const {
  getAllArtists,
  getArtistById,
} = require("./artistsStore");

// GET /api/artists
router.get("/", (req, res) => {
  const artists = getAllArtists();
  res.json({
    success: true,
    count: artists.length,
    artists,
  });
});

// GET /api/artists/:id
router.get("/:id", (req, res) => {
  const { id } = req.params;
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

module.exports = router;