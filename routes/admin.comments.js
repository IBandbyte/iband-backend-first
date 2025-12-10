// routes/admin.comments.js
// Admin-only API for managing comments.
// Base URL: /api/admin/comments

const express = require("express");
const router = express.Router();
const CommentsService = require("../services/commentsService");

// Same admin guard pattern as other admin routes
function adminGuard(req, res, next) {
  const key = req.headers["x-admin-key"];

  if (key !== "mysecret123") {
    return res.status(403).json({
      success: false,
      message: "Invalid admin key.",
    });
  }

  next();
}

// GET /api/admin/comments
// List all comments
router.get("/", adminGuard, async (req, res) => {
  try {
    const comments = await CommentsService.getAllComments();
    return res.json({
      success: true,
      count: comments.length,
      comments,
    });
  } catch (err) {
    console.error("Admin GET /comments error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

// DELETE /api/admin/comments/:id
// Delete a comment by ID
router.delete("/:id", adminGuard, async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await CommentsService.deleteComment(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Comment not found.",
        id,
      });
    }

    return res.json({
      success: true,
      deleted,
    });
  } catch (err) {
    console.error("Admin DELETE /comments/:id error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

module.exports = router;