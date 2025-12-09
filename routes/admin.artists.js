// routes/admin.artists.js
// Admin-only CRUD API for artists under /api/admin/artists

const express = require("express");
const router = express.Router();
const ArtistsService = require("../services/artistsService");

// Simple admin-key guard
function adminGuard(req, res, next) {
  const key = req.headers["x-admin-key"];

  if (key !== "mysecret123") {
    return res.status(403).json({
      success: false,
      message: "Invalid admin key.",
    });
  }

  next();
}

// GET /api/admin/artists
// List all artists
router.get("/", adminGuard, async (req, res) => {
  try {
    const artists = await ArtistsService.getAllArtists();
    res.json({
      success: true,
      count: artists.length,
      artists,
    });
  } catch (err) {
    console.error("Admin GET /artists error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

// POST /api/admin/artists/seed
// Create (seed) a new artist
router.post("/seed", adminGuard, async (req, res) => {
  try {
    const artist = await ArtistsService.createArtist(req.body);

    res.status(201).json({
      success: true,
      artist,
    });
  } catch (err) {
    console.error("Admin POST /artists/seed error:", err);
    res.status(500).json({
      success: false,
      message: "Unable to create artist.",
      error: err.message,
    });
  }
});

// PUT /api/admin/artists/:id
// Update an existing artist (partial updates allowed)
router.put("/:id", adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await ArtistsService.updateArtist(id, req.body);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Artist not found.",
        id,
      });
    }

    res.json({
      success: true,
      artist: updated,
    });
  } catch (err) {
    console.error("Admin PUT /artists/:id error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

// DELETE /api/admin/artists/:id
// Delete an artist
router.delete("/:id", adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    const removed = await ArtistsService.deleteArtist(id);

    if (!removed) {
      return res.status(404).json({
        success: false,
        message: "Artist not found.",
        id,
      });
    }

    res.json({
      success: true,
      deleted: removed,
    });
  } catch (err) {
    console.error("Admin DELETE /artists/:id error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

module.exports = router;