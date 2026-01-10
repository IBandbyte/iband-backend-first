// adminComments.js (ESM)
// Admin-only comment controls — Option A
// Adds bulk delete + moderation endpoints

import express from "express";
import commentsStore from "./commentsStore.js";

const router = express.Router();

/**
 * GET /api/admin/comments
 * List all comments (admin view)
 */
router.get("/", (req, res) => {
  const comments = commentsStore.getAll();
  return res.status(200).json({
    success: true,
    count: comments.length,
    comments,
  });
});

/**
 * PATCH /api/admin/comments/:id
 * Edit or moderate a single comment
 */
router.patch("/:id", (req, res) => {
  const updated = commentsStore.patch(req.params.id, req.body || {});
  if (!updated) {
    return res.status(404).json({
      success: false,
      message: "Comment not found or invalid update.",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Comment updated.",
    comment: updated,
  });
});

/**
 * POST /api/admin/comments/:id/flag
 * Add a moderation flag
 */
router.post("/:id/flag", (req, res) => {
  const { code, reason } = req.body || {};
  const updated = commentsStore.addFlag(req.params.id, { code, reason });

  if (!updated) {
    return res.status(404).json({
      success: false,
      message: "Comment not found.",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Flag added.",
    comment: updated,
  });
});

/**
 * POST /api/admin/comments/:id/flags/clear
 * Clear all flags from a comment
 */
router.post("/:id/flags/clear", (req, res) => {
  const updated = commentsStore.clearFlags(req.params.id);

  if (!updated) {
    return res.status(404).json({
      success: false,
      message: "Comment not found.",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Flags cleared.",
    comment: updated,
  });
});

/**
 * POST /api/admin/comments/bulk-delete
 * Delete multiple comments at once
 */
router.post("/bulk-delete", (req, res) => {
  const { ids } = req.body || {};

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      success: false,
      message: "ids array is required.",
    });
  }

  const result = commentsStore.bulkRemove(ids);

  return res.status(200).json({
    success: true,
    deletedIds: result.deletedIds,
    notFoundIds: result.notFoundIds,
  });
});

/**
 * POST /api/admin/comments/bulk-status
 * Set status for multiple comments
 */
router.post("/bulk-status", (req, res) => {
  const { ids, status, moderatedBy } = req.body || {};

  if (!Array.isArray(ids) || ids.length === 0 || !status) {
    return res.status(400).json({
      success: false,
      message: "ids array and status are required.",
    });
  }

  const result = commentsStore.bulkSetStatus(ids, status, moderatedBy);

  if (!result) {
    return res.status(400).json({
      success: false,
      message: "Invalid status value.",
    });
  }

  return res.status(200).json({
    success: true,
    status: result.status,
    updatedIds: result.updatedIds,
    notFoundIds: result.notFoundIds,
  });
});

/**
 * DELETE /api/admin/comments/:id
 * Delete a single comment
 */
router.delete("/:id", (req, res) => {
  const deleted = commentsStore.remove(req.params.id);
  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: "Comment not found.",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Comment deleted.",
    comment: deleted,
  });
});

/**
 * POST /api/admin/comments/reset
 * Delete all comments
 */
router.post("/reset", (req, res) => {
  const deleted = commentsStore.reset();
  return res.status(200).json({
    success: true,
    deleted,
    message: "All comments deleted.",
  });
});

export default router;