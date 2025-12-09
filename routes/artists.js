const express = require("express");
const router = express.Router();

const artistsDb = require("../db/artists");

// ---------------------------------------------------------------------------
// PUBLIC ARTISTS API (backed by the same in-memory store as admin)
// ---------------------------------------------------------------------------
// This powers:
//   GET  /api/artists       → list all artists (public view)
//   GET  /api/artists/:id   → single artist by numeric id
//
// Admin CRUD still uses /api/admin/artists/* and the same artistsDb module.
// ---------------------------------------------------------------------------

// GET /api/artists → list of all artists
router.get("/artists", (req, res) => {
  try {
    const artists = artistsDb.getAll();

    // Keep the response simple: just the array,
    // same style as the old fake endpoint.
    return res.json(artists);
  } catch (err) {
    console.error("Error in GET /api/artists:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch artists.",
    });
  }
});

// GET /api/artists/:id → single artist detail
router.get("/artists/:id", (req, res) => {
  const { id } = req.params;

  try {
    const artist = artistsDb.getById(id);

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist not found.",
        id,
      });
    }

    return res.json(artist);
  } catch (err) {
    console.error("Error in GET /api/artists/:id:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch artist.",
      id,
    });
  }
});

module.exports = router;