const express = require("express");
const router = express.Router();
const ArtistsService = require("../services/artistsService");

// Simple admin check
function adminGuard(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (key !== "mysecret123") {
    return res.status(403).json({
      success: false,
      message: "Invalid admin key."
    });
  }
  next();
}

// GET all artists
router.get("/", adminGuard, async (req, res) => {
  const artists = await ArtistsService.getAllArtists();
  res.json({ success: true, count: artists.length, artists });
});

// CREATE artist
router.post("/seed", adminGuard, async (req, res) => {
  try {
    const artist = await ArtistsService.createArtist(req.body);
    res.status(201).json({ success: true, artist });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Unable to create artist.",
      error: err.message
    });
  }
});

// UPDATE artist
router.put("/:id", adminGuard, async (req, res) => {
  const updated = await ArtistsService.updateArtist(req.params.id, req.body);

  if (!updated) {
    return res.status(404).json({
      success: false,
      message: "Artist not found.",
      id: req.params.id
    });
  }

  res.json({ success: true, artist: updated });
});

// DELETE artist
router.delete("/:id", adminGuard, async (req, res) => {
  const removed = await ArtistsService.deleteArtist(req.params.id);

  if (!removed) {
    return res.status(404).json({
      success: false,
      message: "Artist not found.",
      id: req.params.id
    });
  }

  res.json({ success: true, deleted: removed });
});

module.exports = router;