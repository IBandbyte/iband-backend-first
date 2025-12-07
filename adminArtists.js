// adminArtists.js
// Admin-only artist management + seeding with safe logging

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

// --- Admin key setup --------------------------------------------------------

const ADMIN_KEY = process.env.ADMIN_KEY || "mysecret123";

function requireAdminKey(req, res, next) {
  const headerKey = req.headers["x-admin-key"];

  if (!headerKey) {
    return res.status(401).json({
      success: false,
      message: "Missing admin key.",
    });
  }

  if (headerKey !== ADMIN_KEY) {
    return res.status(403).json({
      success: false,
      message: "Invalid admin key.",
    });
  }

  next();
}

// --- Admin artist routes ----------------------------------------------------

// GET /api/admin/artists
// List all artists (admin view)
router.get("/", requireAdminKey, (req, res) => {
  try {
    const artists = getAllArtists();
    res.json({
      success: true,
      count: artists.length,
      artists,
    });
  } catch (err) {
    console.error("ADMIN /artists GET error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

// POST /api/admin/artists/reset
// Reset artist store to empty array
router.post("/reset", requireAdminKey, (req, res) => {
  try {
    const { deletedCount } = resetArtists();
    res.json({
      success: true,
      message: "All artists have been reset.",
      deletedCount,
    });
  } catch (err) {
    console.error("ADMIN /artists/reset error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

// POST /api/admin/artists/seed
// Seed one or more artists (array or single object)
router.post("/seed", requireAdminKey, (req, res) => {
  try {
    // 🔍 LOG EXACTLY WHAT WE RECEIVED
    console.log("ADMIN /artists/seed BODY RECEIVED:", req.body);

    const payload = req.body;

    if (!payload || (typeof payload === "object" && Object.keys(payload).length === 0)) {
      // No body or empty object => 400 instead of 500
      return res.status(400).json({
        success: false,
        message: "No artist data provided in request body.",
      });
    }

    // Allow single object OR array of objects
    const toSeed = Array.isArray(payload) ? payload : [payload];

    const createdArtists = [];

    for (const item of toSeed) {
      if (!item || typeof item !== "object") continue;

      const {
        name,
        genre = "Unknown",
        bio = "",
        imageUrl = "",
      } = item;

      // Skip entries without a name
      if (!name || typeof name !== "string" || !name.trim()) continue;

      const artist = createArtist({
        name: name.trim(),
        genre: typeof genre === "string" ? genre.trim() : "Unknown",
        bio: typeof bio === "string" ? bio.trim() : "",
        imageUrl: typeof imageUrl === "string" ? imageUrl.trim() : "",
      });

      createdArtists.push(artist);
    }

    if (createdArtists.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid artists were provided to seed.",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Artists seeded successfully.",
      count: createdArtists.length,
      artists: createdArtists,
    });
  } catch (err) {
    console.error("ADMIN /artists/seed error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

// (Optional) GET /api/admin/artists/:id - inspect a single artist as admin
router.get("/:id", requireAdminKey, (req, res) => {
  try {
    const { id } = req.params;
    const artist = getArtistById(id);

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
    console.error("ADMIN /artists/:id GET error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

module.exports = router;