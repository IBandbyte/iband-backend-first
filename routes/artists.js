const express = require("express");
const router = express.Router();

// Pull in-memory admin artists from our DB module
const { artists: adminArtists, getAllArtists } = require("../db");

// Fixed demo artists (public-facing seed data)
const DEMO_ARTISTS = [
  {
    _id: "A",
    name: "Alpha Band",
    genre: "Alt Rock",
    votes: 0,
    comments: [],
    imageUrl: "https://example.com/alpha.jpg",
  },
  {
    _id: "B",
    name: "Beta Beats",
    genre: "Hip Hop",
    votes: 0,
    comments: [],
    imageUrl: "https://example.com/beta.jpg",
  },
  {
    _id: "C",
    name: "Cosmic Choir",
    genre: "Pop",
    votes: 0,
    comments: [],
    imageUrl: "https://example.com/cosmic.jpg",
  },
];

// Helper to get ALL artists: demo + admin-created
function getCombinedArtists() {
  // Prefer the helper if it exists, otherwise fall back to the exported array
  const admin =
    typeof getAllArtists === "function" ? getAllArtists() : adminArtists || [];

  return [...DEMO_ARTISTS, ...admin];
}

// GET /api/artists  → list all artists (demo + admin)
router.get("/", (req, res) => {
  try {
    const combined = getCombinedArtists();

    return res.json({
      success: true,
      count: combined.length,
      artists: combined,
    });
  } catch (err) {
    console.error("Error in GET /api/artists:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch artists." });
  }
});

// GET /api/artists/:id  → fetch single artist by id or _id
router.get("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const combined = getCombinedArtists();

    const artist = combined.find(
      (a) =>
        String(a.id) === String(id) ||
        String(a._id) === String(id) ||
        String(a.id) === String(Number(id)) // handles numeric ids passed as strings
    );

    if (!artist) {
      return res
        .status(404)
        .json({ success: false, message: "Artist not found." });
    }

    return res.json({
      success: true,
      artist,
    });
  } catch (err) {
    console.error("Error in GET /api/artists/:id:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch artist." });
  }
});

module.exports = router;