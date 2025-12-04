// comments.js
// Comments router for iBand backend (in-memory, DB-ready API shape)
//
// Comment structure:
// {
//   id: string,
//   artistId: string,
//   author: string | null,
//   text: string,
//   createdAt: string (ISO),
//   updatedAt: string (ISO)
// }
//
// NOTE:
// - This is an in-memory store for now (resets when the server restarts).
// - The route shapes are designed so we can later swap in a real DB
//   without breaking the frontend API contract.

const express = require("express");
const router = express.Router();

let nextCommentId = 1;
let comments = [];

/**
 * Validate payload for creating/updating a comment.
 */
function validateCommentPayload(body, { requireText = true, requireArtistId = true } = {}) {
  const errors = [];

  if (requireArtistId && (!body.artistId || typeof body.artistId !== "string")) {
    errors.push("artistId is required and must be a string.");
  }

  if (requireText && (!body.text || typeof body.text !== "string" || !body.text.trim())) {
    errors.push("text is required and must be a non-empty string.");
  }

  if (body.author && typeof body.author !== "string") {
    errors.push("author must be a string if provided.");
  }

  return errors;
}

/**
 * GET /api/comments
 * Return all comments (optionally filtered by artistId via query).
 * Query params:
 * - artistId (optional) – filter comments for a specific artist
 */
router.get("/", (req, res) => {
  try {
    const { artistId } = req.query;
    let result = comments;

    if (artistId) {
      result = result.filter((c) => String(c.artistId) === String(artistId));
    }

    res.json({
      success: true,
      count: result.length,
      comments: result,
    });
  } catch (error) {
    console.error("GET /api/comments error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch comments.",
    });
  }
});

/**
 * GET /api/comments/by-artist/:artistId
 * Return comments for a specific artist.
 */
router.get("/by-artist/:artistId", (req, res) => {
  try {
    const { artistId } = req.params;
    const artistComments = comments.filter(
      (c) => String(c.artistId) === String(artistId)
    );

    res.json({
      success: true,
      artistId: String(artistId),
      count: artistComments.length,
      comments: artistComments,
    });
  } catch (error) {
    console.error("GET /api/comments/by-artist/:artistId error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch artist comments.",
    });
  }
});

/**
 * GET /api/comments/:id
 * Fetch a single comment by ID.
 */
router.get("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const comment = comments.find((c) => String(c.id) === String(id));

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
  } catch (error) {
    console.error("GET /api/comments/:id error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch comment.",
    });
  }
});

/**
 * POST /api/comments
 * Create a new comment.
 *
 * Body:
 * - artistId (string, required)
 * - text (string, required)
 * - author (string, optional)
 */
router.post("/", (req, res) => {
  try {
    const errors = validateCommentPayload(req.body, {
      requireArtistId: true,
      requireText: true,
    });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid comment payload.",
        errors,
      });
    }

    const { artistId, text, author } = req.body;
    const now = new Date().toISOString();

    const newComment = {
      id: String(nextCommentId++),
      artistId: String(artistId),
      text: text.trim(),
      author: author ? String(author).trim() : null,
      createdAt: now,
      updatedAt: now,
    };

    comments.push(newComment);

    res.status(201).json({
      success: true,
      message: "Comment created successfully.",
      comment: newComment,
    });
  } catch (error) {
    console.error("POST /api/comments error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create comment.",
    });
  }
});

/**
 * PATCH /api/comments/:id
 * Update an existing comment (text/author only).
 *
 * Body (any subset):
 * - text (string, optional)
 * - author (string, optional)
 */
router.patch("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const index = comments.findIndex((c) => String(c.id) === String(id));

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "Comment not found.",
      });
    }

    const errors = validateCommentPayload(req.body, {
      requireArtistId: false,
      requireText: false,
    });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid comment payload.",
        errors,
      });
    }

    const existing = comments[index];
    const patch = {};
    const now = new Date().toISOString();

    if (typeof req.body.text !== "undefined") {
      patch.text = req.body.text ? req.body.text.trim() : existing.text;
    }
    if (typeof req.body.author !== "undefined") {
      patch.author = req.body.author
        ? String(req.body.author).trim()
        : null;
    }

    const updated = {
      ...existing,
      ...patch,
      updatedAt: now,
    };

    comments[index] = updated;

    res.json({
      success: true,
      message: "Comment updated successfully.",
      comment: updated,
    });
  } catch (error) {
    console.error("PATCH /api/comments/:id error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update comment.",
    });
  }
});

/**
 * DELETE /api/comments/:id
 * Delete a single comment by ID.
 */
router.delete("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const index = comments.findIndex((c) => String(c.id) === String(id));

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "Comment not found.",
      });
    }

    const removed = comments.splice(index, 1)[0];

    res.json({
      success: true,
      message: "Comment deleted successfully.",
      comment: removed,
    });
  } catch (error) {
    console.error("DELETE /api/comments/:id error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete comment.",
    });
  }
});

/**
 * DELETE /api/comments/by-artist/:artistId
 * Delete all comments for a given artist.
 */
router.delete("/by-artist/:artistId", (req, res) => {
  try {
    const { artistId } = req.params;
    const before = comments.length;
    comments = comments.filter(
      (c) => String(c.artistId) !== String(artistId)
    );
    const removedCount = before - comments.length;

    res.json({
      success: true,
      message: "Comments deleted for artist.",
      artistId: String(artistId),
      removedCount,
    });
  } catch (error) {
    console.error("DELETE /api/comments/by-artist/:artistId error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete artist comments.",
    });
  }
});

module.exports = router;