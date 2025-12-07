// adminArtists.js
// Full admin artist CRUD + seed/reset routes – uses existing artistsStore helpers

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

// Same admin key pattern as adminComments.js
const ADMIN_KEY = process.env.ADMIN_KEY || "mysecret123";

/**
 * Simple middleware to protect admin routes
 */
function requireAdmin(req, res, next) {
  const headerKey = req.headers["x-admin-key"];

  if (!headerKey || headerKey !== ADMIN_KEY) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: invalid or missing admin key",
    });
  }

  next();
}

// GET /api/admin/artists
router.get("/", requireAdmin, (req, res) => {
  try {
    const artists = typeof getAllArtists === "function" ? getAllArtists() : [];

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

// GET /api/admin/artists/:id
router.get("/:id", requireAdmin, (req, res) => {
  try {
    const { id } = req.params;

    if (typeof getArtistById !== "function") {
      return res.status(501).json({
        success: false,
        message: "getArtistById not implemented in artistsStore.",
      });
    }

    const artist = getArtistById(String(id));

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: `Artist with id ${id} not found.`,
      });
    }

    res.json({
      success: true,
      artist,
    });
  } catch (err) {
    console.error("Admin GET /artists/:id error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

// POST /api/admin/artists
router.post("/", requireAdmin, (req, res) => {
  try {
    if (typeof createArtist !== "function") {
      return res.status(501).json({
        success: false,
        message: "createArtist not implemented in artistsStore.",
      });
    }

    const { name, genre, bio, imageUrl, social } = req.body || {};

    if (!name || typeof name !== "string") {
      return res.status(400).json({
        success: false,
        message: "Field 'name' is required.",
      });
    }

    const artist = createArtist({
      name: name.trim(),
      genre: genre || "",
      bio: bio || "",
      imageUrl: imageUrl || "",
      social: social || {},
    });

    res.status(201).json({
      success: true,
      message: "Artist created successfully.",
      artist,
    });
  } catch (err) {
    console.error("Admin POST /artists error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

// PUT /api/admin/artists/:id
router.put("/:id", requireAdmin, (req, res) => {
  try {
    if (typeof updateArtist !== "function") {
      return res.status(501).json({
        success: false,
        message: "updateArtist not implemented in artistsStore.",
      });
    }

    const { id } = req.params;
    const updates = req.body || {};

    const updated = updateArtist(String(id), updates);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: `Artist with id ${id} not found.`,
      });
    }

    res.json({
      success: true,
      message: "Artist updated successfully.",
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
router.delete("/:id", requireAdmin, (req, res) => {
  try {
    if (typeof deleteArtist !== "function") {
      return res.status(501).json({
        success: false,
        message: "deleteArtist not implemented in artistsStore.",
      });
    }

    const { id } = req.params;
    const deleted = deleteArtist(String(id));

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: `Artist with id ${id} not found.`,
      });
    }

    res.json({
      success: true,
      message: "Artist deleted.",
      id: String(id),
    });
  } catch (err) {
    console.error("Admin DELETE /artists/:id error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

// POST /api/admin/artists/reset
router.post("/reset", requireAdmin, (req, res) => {
  try {
    if (typeof resetArtists !== "function") {
      return res.status(501).json({
        success: false,
        message: "resetArtists not implemented in artistsStore.",
      });
    }

    const { deleted, seeded } = resetArtists();

    res.json({
      success: true,
      message: "Artists have been reset.",
      deleted: typeof deleted === "number" ? deleted : undefined,
      seeded: typeof seeded === "number" ? seeded : undefined,
    });
  } catch (err) {
    console.error("Admin POST /artists/reset error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

// POST /api/admin/artists/seed
// Accepts either a single artist object or an array of artist objects.
router.post("/seed", requireAdmin, (req, res) => {
  try {
    if (typeof createArtist !== "function") {
      return res.status(501).json({
        success: false,
        message: "createArtist not implemented in artistsStore.",
      });
    }

    const payload = req.body;
    if (!payload) {
      return res.status(400).json({
        success: false,
        message: "Request body is required.",
      });
    }

    const items = Array.isArray(payload) ? payload : [payload];
    const created = [];

    for (const data of items) {
      if (!data || typeof data.name !== "string" || !data.name.trim()) {
        // Skip invalid entries instead of crashing
        continue;
      }

      const artist = createArtist({
        name: data.name.trim(),
        genre: data.genre || "",
        bio: data.bio || "",
        imageUrl: data.imageUrl || "",
        social: data.social || {},
      });

      created.push(artist);
    }

    res.status(201).json({
      success: true,
      message: "Artists seeded successfully.",
      count: created.length,
      artists: created,
    });
  } catch (err) {
    console.error("Admin POST /artists/seed error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

module.exports = router;