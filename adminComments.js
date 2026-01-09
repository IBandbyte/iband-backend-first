import express from "express";
import commentsStore from "./commentsStore.js";

const router = express.Router();

/**
 * Helpers
 */
function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeCommentPayload(body = {}) {
  return {
    artistId: isNonEmptyString(body.artistId) ? body.artistId.trim() : undefined,
    author: isNonEmptyString(body.author) ? body.author.trim() : undefined,
    text: isNonEmptyString(body.text) ? body.text.trim() : undefined,
  };
}

/**
 * GET /api/admin/comments
 * List all comments
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
 * GET /api/admin/comments/:id
 * Get a single comment by id
 */
router.get("/:id", (req, res) => {
  const comment = commentsStore.getById(req.params.id);
  if (!comment) {
    return res.status(404).json({ success: false, message: "Comment not found." });
  }
  return res.status(200).json({ success: true, comment });
});

/**
 * POST /api/admin/comments
 * Create a comment
 */
router.post("/", (req, res) => {
  const payload = normalizeCommentPayload(req.body);

  if (!payload.artistId) {
    return res.status(400).json({
      success: false,
      message: "Validation error: 'artistId' is required.",
    });
  }

  if (!payload.author) {
    return res.status(400).json({
      success: false,
      message: "Validation error: 'author' is required.",
    });
  }

  if (!payload.text) {
    return res.status(400).json({
      success: false,
      message: "Validation error: 'text' is required.",
    });
  }

  const created = commentsStore.create({
    artistId: payload.artistId,
    author: payload.author,
    text: payload.text,
  });

  return res.status(201).json({
    success: true,
    message: "Comment created successfully.",
    comment: created,
  });
});

/**
 * PUT /api/admin/comments/:id
 * Replace full comment (requires artistId, author, text)
 */
router.put("/:id", (req, res) => {
  const existing = commentsStore.getById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "Comment not found." });
  }

  const payload = normalizeCommentPayload(req.body);

  if (!payload.artistId || !payload.author || !payload.text) {
    return res.status(400).json({
      success: false,
      message: "Validation error: 'artistId', 'author', and 'text' are required.",
    });
  }

  const updated = commentsStore.update(req.params.id, {
    artistId: payload.artistId,
    author: payload.author,
    text: payload.text,
  });

  return res.status(200).json({
    success: true,
    message: "Comment updated successfully.",
    comment: updated,
  });
});

/**
 * PATCH /api/admin/comments/:id
 * Partial update
 */
router.patch("/:id", (req, res) => {
  const existing = commentsStore.getById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "Comment not found." });
  }

  const payload = normalizeCommentPayload(req.body);

  if (payload.artistId === undefined && payload.author === undefined && payload.text === undefined) {
    return res.status(400).json({
      success: false,
      message: "No valid fields provided to update.",
    });
  }

  const updated = commentsStore.patch(req.params.id, payload);

  return res.status(200).json({
    success: true,
    message: "Comment patched successfully.",
    comment: updated,
  });
});

/**
 * DELETE /api/admin/comments/:id
 */
router.delete("/:id", (req, res) => {
  const existing = commentsStore.getById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "Comment not found." });
  }

  const deleted = commentsStore.remove(req.params.id);

  return res.status(200).json({
    success: true,
    message: "Comment deleted successfully.",
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
    message: "All comments have been deleted.",
  });
});

/**
 * POST /api/admin/comments/seed
 * Seed demo comments (optional, safe)
 */
router.post("/seed", (req, res) => {
  const seeded = commentsStore.seed?.() ?? 0;
  return res.status(200).json({
    success: true,
    seeded,
    message: "Demo comments seeded successfully.",
  });
});

/**
 * ✅ CRITICAL FIX:
 * Provide default export so admin.js can import it as default.
 */
export default router;