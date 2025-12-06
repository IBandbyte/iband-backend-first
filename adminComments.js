// adminComments.js
// Full admin comment CRUD routes — synced with commentsStore.js

const express = require("express");
const router = express.Router();

const {
  getAllComments,
  getCommentsByArtist,
  getCommentById,
  createComment,
  deleteComment,
  deleteCommentsByArtist,
  resetComments,
} = require("./commentsStore");

const ADMIN_KEY = process.env.ADMIN_KEY || "";

// Middleware to verify admin access (optional)
function requireAdmin(req, res, next) {
  if (!ADMIN_KEY) return next();
  const key = req.headers["x-admin-key"];
  if (key !== ADMIN_KEY)
    return res.status(403).json({
      success: false,
      message: "Forbidden: invalid or missing x-admin-key.",
    });
  next();
}

// Helper to validate text fields
function validateText(field) {
  return typeof field === "string" && field.trim().length > 0;
}

// ----------------------
// 🚀 ADMIN COMMENT ROUTES
// ----------------------

// GET /api/admin/comments
// Optional ?artistId= to filter
router.get("/", requireAdmin, (req, res) => {
  const { artistId } = req.query;
  const comments = artistId
    ? getCommentsByArtist(artistId)
    : getAllComments();

  res.json({
    success: true,
    count: comments.length,
    ...(artistId ? { artistId: String(artistId) } : {}),
    comments,
  });
});

// GET /api/admin/comments/:id
router.get("/:id", requireAdmin, (req, res) => {
  const comment = getCommentById(req.params.id);
  if (!comment)
    return res
      .status(404)
      .json({ success: false, message: "Comment not found." });

  res.json({ success: true, comment });
});

// POST /api/admin/comments
// Create a new comment manually
router.post("/", requireAdmin, (req, res) => {
  const { artistId, author, text } = req.body || {};
  if (!artistId)
    return res.status(400).json({
      success: false,
      message: "artistId is required.",
    });

  if (!validateText(text))
    return res.status(400).json({
      success: false,
      message: "text is required and cannot be empty.",
    });

  const comment = createComment({ artistId, author, text });
  res.status(201).json({
    success: true,
    message: "Comment created successfully.",
    comment,
  });
});

// PUT /api/admin/comments/:id
// Replace a comment (idempotent)
router.put("/:id", requireAdmin, (req, res) => {
  const { author, text } = req.body || {};
  const existing = getCommentById(req.params.id);
  if (!existing)
    return res
      .status(404)
      .json({ success: false, message: "Comment not found." });

  if (!validateText(text))
    return res.status(400).json({
      success: false,
      message: "text is required.",
    });

  // Delete old + recreate
  deleteComment(req.params.id);
  const updated = createComment({
    artistId: existing.artistId,
    author: author || existing.author,
    text,
  });

  res.json({
    success: true,
    message: "Comment replaced successfully.",
    comment: updated,
  });
});

// PATCH /api/admin/comments/:id
// Update text or author only
router.patch("/:id", requireAdmin, (req, res) => {
  const existing = getCommentById(req.params.id);
  if (!existing)
    return res
      .status(404)
      .json({ success: false, message: "Comment not found." });

  const { author, text } = req.body || {};
  if (!author && !text)
    return res.status(400).json({
      success: false,
      message: "Provide at least one field (author or text).",
    });

  const updated = {
    ...existing,
    author: validateText(author) ? author : existing.author,
    text: validateText(text) ? text : existing.text,
  };

  // Simulate persistence by deleting + recreating with same id
  deleteComment(existing.id);
  const recreated = createComment({
    artistId: updated.artistId,
    author: updated.author,
    text: updated.text,
  });
  recreated.id = existing.id;

  res.json({
    success: true,
    message: "Comment updated successfully.",
    comment: recreated,
  });
});

// DELETE /api/admin/comments/:id
router.delete("/:id", requireAdmin, (req, res) => {
  const deleted = deleteComment(req.params.id);
  if (!deleted)
    return res
      .status(404)
      .json({ success: false, message: "Comment not found." });
  res.json({
    success: true,
    message: "Comment deleted.",
    comment: deleted,
  });
});

// DELETE /api/admin/comments/by-artist/:artistId
router.delete("/by-artist/:artistId", requireAdmin, (req, res) => {
  const { artistId } = req.params;
  const { deleted } = deleteCommentsByArtist(artistId);
  res.json({
    success: true,
    message: `Deleted ${deleted} comment(s) for artist ${artistId}.`,
    deleted,
    artistId: String(artistId),
  });
});

// POST /api/admin/comments/reset
router.post("/reset", requireAdmin, (_req, res) => {
  const deleted = resetComments();
  res.json({
    success: true,
    deleted,
    message: "All comments have been reset.",
  });
});

module.exports = router;