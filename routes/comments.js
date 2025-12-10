// routes/comments.js
// Public comments API for a specific artist.
// Base URL: /api/comments

const express = require("express");
const router = express.Router();
const CommentsService = require("../services/commentsService");

// POST /api/comments/:artistId
// Add a new comment for an artist.
router.post("/:artistId", async (req, res) => {
  try {
    const { artistId } = req.params;
    const { user, text } = req.body || {};

    if (!user || !text) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: user, text.",
      });
    }

    const comment = await CommentsService.addComment(artistId, {
      user,
      text,
    });

    return res.status(201).json({
      success: true,
      comment,
    });
  } catch (err) {
    console.error("POST /api/comments/:artistId error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to add comment.",
    });
  }
});

// GET /api/comments/:artistId
// Get all comments for an artist.
router.get("/:artistId", async (req, res) => {
  try {
    const { artistId } = req.params;

    const comments =
      (await CommentsService.getCommentsForArtist(artistId)) || [];

    return res.json({
      success: true,
      artistId,
      count: comments.length,
      comments,
    });
  } catch (err) {
    console.error("GET /api/comments/:artistId error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch comments.",
    });
  }
});

module.exports = router;