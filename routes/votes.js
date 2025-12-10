// routes/votes.js
// Public voting API for artists.
// Endpoint: POST /api/votes/:artistId

const express = require("express");
const router = express.Router();

const { voteForArtist, getArtistById } = require("../db");

// POST /api/votes/:artistId
// Increments the vote count for the given artist.
router.post("/:artistId", (req, res) => {
  try {
    const { artistId } = req.params;

    // Ensure artist exists
    const existing = getArtistById(artistId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Artist not found.",
        artistId,
      });
    }

    const updated = voteForArtist(artistId);

    return res.json({
      success: true,
      artistId: updated.id,
      votes: updated.votes,
    });
  } catch (err) {
    console.error("Error in POST /api/votes/:artistId:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to register vote.",
    });
  }
});

module.exports = router;