// adminArtists.js
// Full admin artist CRUD + seed routes – reusing artistsStore helpers

const express = require("express");
const router = express.Router();

const {
  getAllArtists,
  getArtistById,
  createArtist,
  updateArtist,
  deleteArtist,
  resetArtists,
} = require("./artistsStore");

const ADMIN_KEY = process.env.ADMIN_KEY || "mysecret123";

// Simple admin auth guard using x-admin-key header
function requireAdmin(req, res, next) {
  const headerKey = req.header("x-admin-key");

  if (!headerKey || headerKey !== ADMIN_KEY) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: invalid admin key.",
    });
  }

  next();
}

// Normalize incoming artist data so we don't explode if fields are missing
function normalizeArtistPayload(payload = {}) {
  const { name, genre, bio, imageUrl } = payload;

  return {
    name: typeof name === "string" ? name.trim() : "",
    genre: typeof genre === "string" ? genre.trim() : "",
    bio: typeof bio === "string" ? bio.trim() : "",
    imageUrl: typeof imageUrl === "string" ? imageUrl.trim() : "",
  };
}

// GET /api/admin/artists
router.get("/artists", requireAdmin, (req, res) => {
  try {
    const artists = getAllArtists();
    res.json({
      success: true,
      count: artists.length,
      artists,
    });
  } catch (err) {
    console.error("Error in GET /api/admin/artists:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

// GET /api/admin/artists/:id
router.get("/artists/:id", requireAdmin, (req, res) => {
  try {
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
  } catch (err) {
    console.error("Error in GET /api/admin/artists/:id:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

// POST /api/admin/artists
// Standard admin "create artist"
router.post("/artists", requireAdmin, (req, res) => {
  try {
    const payload = normalizeArtistPayload(req.body);

    if (!payload.name || !payload.genre) {
      return res.status(400).json({
        success: false,
        message: "name and genre are required.",
      });
    }

    const created = createArtist(payload);

    res.status(201).json({
      success: true,
      message: "Artist created.",
      artist: created,
    });
  } catch (err) {
    console.error("Error in POST /api/admin/artists:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

// PUT /api/admin/artists/:id
router.put("/artists/:id", requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const payload = normalizeArtistPayload(req.body);

    const updated = updateArtist(id, payload);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Artist not found.",
      });
    }

    res.json({
      success: true,
      message: "Artist updated.",
      artist: updated,
    });
  } catch (err) {
    console.error("Error in PUT /api/admin/artists/:id:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

// DELETE /api/admin/artists/:id
router.delete("/artists/:id", requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const deleted = deleteArtist(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Artist not found.",
      });
    }

    res.json({
      success: true,
      message: "Artist deleted.",
      artist: deleted,
    });
  } catch (err) {
    console.error("Error in DELETE /api/admin/artists/:id:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

// POST /api/admin/artists/reset
// Reset to the default artist list in artistsStore
router.post("/artists/reset", requireAdmin, (req, res) => {
  try {
    const { deleted, count, artists } = resetArtists();

    res.json({
      success: true,
      deleted,
      count,
      artists,
      message: "Artists have been reset to defaults.",
    });
  } catch (err) {
    console.error("Error in POST /api/admin/artists/reset:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

// POST /api/admin/artists/seed
// NEW: "Seed" route – uses createArtist under the hood.
// - If body is an array: creates many.
// - If body is an object: creates a single artist.
router.post("/artists/seed", requireAdmin, (req, res) => {
  try {
    const body = req.body;

    // Seed multiple
    if (Array.isArray(body)) {
      const created = body
        .map(normalizeArtistPayload)
        .filter((a) => a.name && a.genre)
        .map((a) => createArtist(a));

      return res.status(201).json({
        success: true,
        mode: "batch",
        count: created.length,
        artists: created,
      });
    }

    // Seed single
    const payload = normalizeArtistPayload(body);

    if (!payload.name || !payload.genre) {
      return res.status(400).json({
        success: false,
        message: "name and genre are required for seeding.",
      });
    }

    const artist = createArtist(payload);

    res.status(201).json({
      success: true,
      mode: "single",
      artist,
    });
  } catch (err) {
    console.error("Error in POST /api/admin/artists/seed:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

module.exports = router;