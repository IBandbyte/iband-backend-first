// comments.js (ESM)
// Public comments API

import express from "express";
import commentsStore from "./commentsStore.js";

const router = express.Router();

/**
 * POST /api/comments
 * Create a new comment
 */
router.post("/", (req, res) => {
  try {
    const { artistId, author, text } = req.body || {};
    const created = commentsStore.create({ artistId, author, text });

    return res.status(201).json({
      success: true,
      message: "Comment created successfully.",
      comment: created,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Invalid request.",
    });
  }
});

/**
 * GET /api/comments/by-artist/:artistId
 * List comments for an artist
 */
router.get("/by-artist/:artistId", (req, res) => {
  const { artistId } = req.params;
  const comments = commentsStore.getByArtistId(artistId);

  return res.status(200).json({
    success: true,
    artistId: String(artistId),
    count: comments.length,
    comments,
  });
});

export default router;