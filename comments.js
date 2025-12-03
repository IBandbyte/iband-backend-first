// comments.js
// Comments router for iBand backend
// Handles CRUD operations for fan comments on artists

const express = require("express");
const router = express.Router();

/**
 * Comment structure (in-memory for now):
 * {
 *   id: string,
 *   artistId: string,
 *   authorName: string,
 *   message: string,
 *   createdAt: string (ISO),
 *   updatedAt: string (ISO),
 *   isFlagged: boolean
 * }
 *
 * NOTE:
 * - This is an in-memory store so comments reset when the server restarts.
 * - Later we can swap this for a real database layer without changing routes.
 */

let comments = [];
let nextId = 1;

/**
 * Utility: create a new comment object
 */
function createComment({ artistId, authorName, message }) {
  const now = new Date().toISOString();

  return {
    id: String(nextId++),
    artistId: String(artistId),
    authorName: authorName?.trim() || "Anonymous",
    message: message.trim(),
    createdAt: now,
    updatedAt: now,
    isFlagged: false,
  };
}

/**
 * Utility: basic validation
 */
function validateCommentPayload(body, { requireArtistId = true } = {}) {
  const errors = [];

  if (requireArtistId && !body.artistId) {
    errors.push("artistId is required.");
  }

  if (body.artistId && typeof body.artistId !== "string" && typeof body.artistId !== "number") {
    errors.push("artistId must be a string or number.");
  }

  if (!body.message || typeof body.message !== "string" || !body.message.trim()) {
    errors.push("message is required and must be a non-empty string.");
  }

  if (body.authorName && typeof body.authorName !== "string") {
    errors.push("authorName must be a string if provided.");
  }

  return errors;
}

/**
 * GET /api/comments
 * Optional query parameters:
 * - artistId: filter comments for a specific artist
 * - limit: max number of comments to return
 */
router.get("/", (req, res) => {
  try {
    const { artistId, limit } = req.query;

    let result = comments;

    if (artistId) {
      result = result.filter(
        (c) => String(c.artistId) === String(artistId)
      );
    }

    let numericLimit = parseInt(limit, 10);
    if (!isNaN(numericLimit) && numericLimit > 0) {
      result = result.slice(0, numericLimit);
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
 * GET /api/comments/:id
 * Fetch a single comment by its ID
 */
router.get("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const comment = comments.find((c) => c.id === String(id));

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
 * GET /api/comments/by-artist/:artistId
 * Convenience route to fetch all comments for a given artist
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
 * POST /api/comments
 * Create a new comment for an artist
 * Body:
 * - artistId (required)
 * - message (required)
 * - authorName (optional)
 */
router.post("/", (req, res) => {
  try {
    const errors = validateCommentPayload(req.body, {
      requireArtistId: true,
    });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid comment payload.",
        errors,
      });
    }

    const { artistId, authorName, message } = req.body;
    const newComment = createComment({ artistId, authorName, message });
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
 * PUT /api/comments/:id
 * Update an existing comment (replace message/authorName)
 * Body:
 * - message (optional but must be non-empty if provided)
 * - authorName (optional)
 */
router.put("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const commentIndex = comments.findIndex((c) => c.id === String(id));

    if (commentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Comment not found.",
      });
    }

    const { authorName, message } = req.body;
    const updatedFields = {};

    if (typeof authorName !== "undefined") {
      if (typeof authorName !== "string") {
        return res.status(400).json({
          success: false,
          message: "authorName must be a string.",
        });
      }
      updatedFields.authorName = authorName.trim() || "Anonymous";
    }

    if (typeof message !== "undefined") {
      if (typeof message !== "string" || !message.trim()) {
        return res.status(400).json({
          success: false,
          message: "message must be a non-empty string when provided.",
        });
      }
      updatedFields.message = message.trim();
    }

    const existing = comments[commentIndex];
    const now = new Date().toISOString();

    comments[commentIndex] = {
      ...existing,
      ...updatedFields,
      updatedAt: now,
    };

    res.json({
      success: true,
      message: "Comment updated successfully.",
      comment: comments[commentIndex],
    });
  } catch (error) {
    console.error("PUT /api/comments/:id error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update comment.",
    });
  }
});

/**
 * PATCH /api/comments/:id/flag
 * Flag or unflag a comment (for moderation)
 * Body:
 * - isFlagged (boolean, optional; if omitted, toggles current value)
 */
router.patch("/:id/flag", (req, res) => {
  try {
    const { id } = req.params;
    const commentIndex = comments.findIndex((c) => c.id === String(id));

    if (commentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Comment not found.",
      });
    }

    const current = comments[commentIndex];
    let { isFlagged } = req.body;

    if (typeof isFlagged === "undefined") {
      // Toggle if not explicitly provided
      isFlagged = !current.isFlagged;
    } else if (typeof isFlagged !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isFlagged must be a boolean when provided.",
      });
    }

    const now = new Date().toISOString();

    comments[commentIndex] = {
      ...current,
      isFlagged,
      updatedAt: now,
    };

    res.json({
      success: true,
      message: `Comment ${isFlagged ? "flagged" : "unflagged"} successfully.`,
      comment: comments[commentIndex],
    });
  } catch (error) {
    console.error("PATCH /api/comments/:id/flag error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update comment flag state.",
    });
  }
});

/**
 * DELETE /api/comments/:id
 * Remove a comment completely
 */
router.delete("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const commentIndex = comments.findIndex((c) => c.id === String(id));

    if (commentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Comment not found.",
      });
    }

    const removed = comments.splice(commentIndex, 1)[0];

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

module.exports = router;