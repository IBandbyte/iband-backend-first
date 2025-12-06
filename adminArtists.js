// adminArtists.js
// Full admin artist CRUD + reset/seed routes, protected by x-admin-key

const express = require("express");
const router = express.Router();

const {
  getAllArtists,
  getArtistById,
  createArtist,
  updateArtist,
  deleteArtist,
  resetArtists,
  seedArtists,
} = require("./artistsStore");

const ADMIN_KEY = process.env.ADMIN_KEY || "mysecret123";

// Simple admin-key guard
function requireAdminKey(req, res, next) {
  const headerKey = req.headers["x-admin-key"];

  if (!headerKey || headerKey !== ADMIN_KEY) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: invalid or missing admin key.",
    });
  }

  next();
}

// GET /api/admin/artists
router.get("/", requireAdminKey, (req, res) => {
  const list = getAllArtists();
  res.json({
    success: true,
    count: list.length,
    artists: list,
  });
});

// GET /api/admin/artists/:id
router.get("/:id", requireAdminKey, (req, res) => {
  const artist = getArtistById(req.params.id);

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

// POST /api/admin/artists
router.post("/", requireAdminKey, (req, res) => {
  try {
    const created = createArtist(req.body || {});
    res.status(201).json({
      success: true,
      message: "Artist created.",
      artist: created,
    });
  } catch (err) {
    console.error("Error creating artist:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

// PUT /api/admin/artists/:id
router.put("/:id", requireAdminKey, (req, res) => {
  try {
    const updated = updateArtist(req.params.id, req.body || {});

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Artist not found.",
      });
    }

    res.json({
      success: true,
      message: "Artist fully updated.",
      artist: updated,
    });
  } catch (err) {
    console.error("Error updating artist:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

// PATCH /api/admin/artists/:id
router.patch("/:id", requireAdminKey, (req, res) => {
  try {
    const updated = updateArtist(req.params.id, req.body || {});

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Artist not found.",
      });
    }

    res.json({
      success: true,
      message: "Artist partially updated.",
      artist: updated,
    });
  } catch (err) {
    console.error("Error patching artist:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

// DELETE /api/admin/artists/:id
router.delete("/:id", requireAdminKey, (req, res) => {
  try {
    const result = deleteArtist(req.params.id);

    if (!result.deleted) {
      return res.status(404).json({
        success: false,
        message: "Artist not found.",
      });
    }

    res.json({
      success: true,
      message: "Artist deleted.",
      artist: result.artist,
    });
  } catch (err) {
    console.error("Error deleting artist:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

// POST /api/admin/artists/reset
router.post("/reset", requireAdminKey, (req, res) => {
  try {
    const { deleted } = resetArtists();
    res.json({
      success: true,
      deleted,
      message: "All artists have been deleted (reset).",
    });
  } catch (err) {
    console.error("Error resetting artists:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

// POST /api/admin/artists/seed
router.post("/seed", requireAdminKey, (req, res) => {
  try {
    const result = seedArtists(req.body || {});
    res.status(201).json({
      success: true,
      message: result.usedDefault
        ? "Demo artists seeded from defaults."
        : "Custom artists seeded from request body.",
      seeded: result.seeded,
      artists: result.artists,
    });
  } catch (err) {
    console.error("Error seeding artists:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

module.exports = router;