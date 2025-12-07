// adminArtists.js
// Admin-only endpoints for managing artists.

const express = require("express");
const router = express.Router();
const artistsStore = require("./artistsStore");

const ADMIN_KEY = process.env.ADMIN_KEY || "mysecret123";

function checkAdminKey(req, res, next) {
  const key = req.header("x-admin-key");
  if (!key || key !== ADMIN_KEY) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: invalid admin key."
    });
  }
  next();
}

// GET /api/admin/artists  -> list all artists
router.get("/", checkAdminKey, (req, res) => {
  const all = artistsStore.getAllArtists();
  res.json({
    success: true,
    count: all.length,
    artists: all
  });
});

// POST /api/admin/artists/seed  -> add one artist
router.post("/seed", checkAdminKey, (req, res) => {
  try {
    const { name, genre, bio, imageUrl } = req.body || {};

    if (!name || !genre) {
      return res.status(400).json({
        success: false,
        message: "name and genre are required."
      });
    }

    const artist = artistsStore.addArtist({
      name,
      genre,
      bio: bio || "",
      imageUrl: imageUrl || ""
    });

    return res.status(201).json({
      success: true,
      artist
    });
  } catch (err) {
    console.error("Error seeding artist:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error."
    });
  }
});

// POST /api/admin/artists/reset  -> clear all artists
router.post("/reset", checkAdminKey, (req, res) => {
  try {
    const { deleted } = artistsStore.resetArtists();
    return res.json({
      success: true,
      deleted,
      message: "All artists have been reset."
    });
  } catch (err) {
    console.error("Error resetting artists:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error."
    });
  }
});

module.exports = router;