const express = require("express");
const router = express.Router();

// Simple in-memory fake artists list for the public API.
// This powers:
//   GET /api/artists
//   GET /api/artists/:id
//
// NOTE: Admin CRUD uses a different in-memory store (db/artists.js).
// For now this fake list is just to power the public-facing demo.
const artists = [
  {
    _id: "A",
    name: "Alpha Band",
    votes: 0,
    comments: [
      {
        id: "c1",
        user: "FanOne",
        text: "Love these guys!",
        createdAt: "2025-01-01T10:00:00.000Z",
      },
    ],
  },
  {
    _id: "B",
    name: "Beta Beats",
    votes: 0,
    comments: [
      {
        id: "c2",
        user: "MusicLover",
        text: "Underrated 🔥",
        createdAt: "2025-01-02T12:00:00.000Z",
      },
    ],
  },
  {
    _id: "C",
    name: "Cyber Siren",
    votes: 0,
    comments: [
      {
        id: "c3",
        user: "SynthWave",
        text: "Future headliner.",
        createdAt: "2025-01-03T18:30:00.000Z",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// GET /api/artists  → list of all public artists
// ---------------------------------------------------------------------------
router.get("/artists", (req, res) => {
  // Keep existing behaviour: return raw array (no { success: true } wrapper)
  res.json(artists);
});

// ---------------------------------------------------------------------------
// GET /api/artists/:id  → single artist by ID (A, B, C, etc.)
// ---------------------------------------------------------------------------
router.get("/artists/:id", (req, res) => {
  const { id } = req.params;

  // IDs in this fake list are strings like "A", "B", "C"
  const artist = artists.find((a) => a._id === id);

  if (!artist) {
    return res.status(404).json({
      success: false,
      message: "Artist not found.",
      id,
    });
  }

  // For the detail endpoint we return a single artist object.
  res.json(artist);
});

module.exports = router;