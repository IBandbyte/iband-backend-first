// artists.js
// Public artist API used by the frontend.

const express = require("express");
const router = express.Router();
const artistsStore = require("./artistsStore");

router.get("/artists", (req, res) => {
  const all = artistsStore.getAllArtists();
  res.json({
    success: true,
    count: all.length,
    artists: all
  });
});

router.get("/artists/:id", (req, res) => {
  const { id } = req.params;
  const artist = artistsStore.getArtistById(id);

  if (!artist) {
    return res.status(404).json({
      success: false,
      message: `Artist with id ${id} not found.`
    });
  }

  res.json({
    success: true,
    artist
  });
});

module.exports = router;