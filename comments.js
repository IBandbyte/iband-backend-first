// comments.js
// Public comments API for iBand.
// Uses the central in-memory commentsStore so that admin + public endpoints
// always see the same data.

const express = require("express");
const router = express.Router();

const {
  getAllComments,
  getCommentsByArtist,
  createComment,
  deleteComment,
  deleteCommentsByArtist,
} = require("./commentsStore");

// Helper to standardise 400 error for invalid payloads
function badRequest(res, message) {
  return res.status(400).json({
    success: false,
    message,
  });
}

// GET /api/comments
// List ALL comments
router.get("/", (_req, res) => {
  const all = getAllComments();
  res.json({
    success: true,
    count: all.length,
    comments: all,
  });
});

// GET /api/comments/by-artist/:artistId
// List comments for a single artist
router.get("/by-artist/:artistId", (req, res) => {
  const { artistId } = req.params;
  const artistComments = getCommentsByArtist(artistId);

  res.json({
    success: true,
    artistId: String(artistId),
    count: artistComments.length,
    comments: artistComments,
  });
});

// POST /api/comments
// Create a new comment for an artist
router.post("/", (req, res) => {
  const { artistId, author, text } = req.body || {};

  if (!artistId) {
    return badRequest(res, "artistId is required.");
  }

  if (!text || typeof text !== "string" || !text.trim()) {
    return badRequest(res, "A non-empty text field is required.");
  }

  const comment = createComment({ artistId, author, text });

  res.status(201).json({
    success: true,
    message: "Comment created successfully.",
    comment,
  });
});

// DELETE /api/comments/by-artist/:artistId
// Delete all comments for a specific artist
router.delete("/by-artist/:artistId", (req, res) => {
  const { artistId } = req.params;
  const { deleted } = deleteCommentsByArtist(artistId);

  res.json({
    success: true,
    message: `Deleted ${deleted} comment(s) for artist ${artistId}.`,
    deleted,
    artistId: String(artistId),
  });
});

// DELETE /api/comments/:id
// Delete a specific comment by ID
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const deleted = deleteComment(id);

  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: "Comment not found.",
    });
  }

  res.json({
    success: true,
    message: "Comment deleted.",
    comment: deleted,
  });
});

module.exports = router;