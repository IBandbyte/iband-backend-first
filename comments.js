// comments.js
// Public comments API for artists.
// Mounted at /api/comments in server.js.
//
// Endpoints:
//   GET  /api/comments/:artistId   -> list comments for an artist
//   POST /api/comments/:artistId   -> add a comment for an artist

const express = require("express");
const router = express.Router();

const { getArtistById, getCommentsForArtist, addComment } = require("./db");

// GET /api/comments/:artistId
// List comments for a single artist
router.get("/:artistId", (req, res) => {
  try {
    const { artistId } = req.params;
    const artist = getArtistById(artistId);

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist not found.",
        artistId,
      });
    }

    const comments = getCommentsForArtist(artistId) || [];

    return res.json({
      success: true,
      artistId: artist.id,
      count: comments.length,
      comments,
    });
  } catch (err) {
    console.error("Error in GET /api/comments/:artistId:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch comments.",
    });
  }
});

// POST /api/comments/:artistId
// Add a new comment to an artist
router.post("/:artistId", (req, res) => {
  try {
    const { artistId } = req.params;
    const artist = getArtistById(artistId);

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist not found.",
        artistId,
      });
    }

    const { user, text } = req.body || {};

    const comment = addComment(artistId, { user, text });

    return res.status(201).json({
      success: true,
      comment,
    });
  } catch (err) {
    console.error("Error in POST /api/comments/:artistId:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to add comment.",
      error: err.message,
    });
  }
});

module.exports = router;