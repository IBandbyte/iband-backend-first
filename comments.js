// comments.js
// Public comments router (ESM)
// - POST /api/comments            -> create comment (pending)
// - GET  /api/comments/by-artist/:artistId -> list APPROVED comments for artist (never 500)

import express from "express";
import {
  createComment,
  getApprovedCommentsByArtist,
} from "./commentsStore.js";

const router = express.Router();

// --------------------
// POST /api/comments
// Body: { artistId, author, text }
// Creates a PENDING comment.
// --------------------
router.post("/", (req, res) => {
  try {
    const { artistId, author, text } = req.body ?? {};

    const result = createComment({ artistId, author, text });

    if (!result.ok) {
      return res.status(result.statusCode || 400).json({
        success: false,
        message: result.error || "Bad request",
      });
    }

    return res.status(201).json({
      success: true,
      comment: result.comment,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// --------------------
// GET /api/comments/by-artist/:artistId
// Returns APPROVED comments only.
// MUST return 200 + [] when none exist.
// --------------------
router.get("/by-artist/:artistId", (req, res) => {
  try {
    const { artistId } = req.params;

    const comments = getApprovedCommentsByArtist(artistId);

    // Defensive: always coerce to array
    const safe = Array.isArray(comments) ? comments : [];

    return res.status(200).json({
      success: true,
      count: safe.length,
      comments: safe,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;