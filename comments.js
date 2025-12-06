// comments.js
// Public comment API routes for iBand

const express = require("express");
const router = express.Router();

const {
  getAllComments,
  getCommentsByArtist,
  getCommentById,
  createComment,
  deleteComment,
} = require("./commentsStore");

/**
 * Basic payload validation
 */
function validateCreatePayload(body) {
  const errors = [];
  const { artistId, author, text } = body || {};

  if (!artistId && artistId !== 0) {
    errors.push("artistId is required.");
  }

  if (typeof text !== "string" || !text.trim()) {
    errors.push("text is required.");
  } else {
    const len = text.trim().length;
    if (len < 3) {
      errors.push("text must be at least 3 characters.");
    }
    if (len > 500) {
      errors.push("text must be at most 500 characters.");
    }
  }

  if (author != null && typeof author !== "string") {
    errors.push("author must be a string if provided.");
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * GET /api/comments
 * Return all comments (non-deleted).
 */
router.get("/", (req, res) => {
  const comments = getAllComments();
  res.json({
    success: true,
    count: comments.length,
    comments,
  });
});

/**
 * GET /api/comments/by-artist/:artistId
 * Return all comments for a specific artist.
 */
router.get("/by-artist/:artistId", (req, res) => {
  const { artistId } = req.params;
  const comments = getCommentsByArtist(artistId);

  res.json({
    success: true,
    artistId: String(artistId),
    count: comments.length,
    comments,
  });
});

/**
 * GET /api/comments/:id
 * Return a single comment by ID.
 */
router.get("/:id", (req, res) => {
  const { id } = req.params;
  const comment = getCommentById(id);

  if (!comment) {
    return res.status(404).json({
      success: false,
      message: "Comment not found.",
    });
  }

  res.json({
    success: true,
    comment,
  });
});

/**
 * POST /api/comments
 * Create a new public comment.
 *
 * Body: { artistId, author?, text }
 */
router.post("/", (req, res) => {
  const { isValid, errors } = validateCreatePayload(req.body);

  if (!isValid) {
    return res.status(400).json({
      success: false,
      message: "Invalid comment payload.",
      errors,
    });
  }

  const { artistId, author, text } = req.body;

  const comment = createComment({
    artistId,
    author,
    text,
  });

  res.status(201).json({
    success: true,
    message: "Comment created successfully.",
    comment,
  });
});

/**
 * DELETE /api/comments/:id
 * Public delete (for future use: may be restricted later).
 */
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const { deleted } = deleteComment(id);

  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: "Comment not found.",
    });
  }

  res.json({
    success: true,
    message: "Comment deleted.",
    id: String(id),
  });
});

module.exports = router;