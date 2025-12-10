// adminComments.js
// Admin-only comments moderation API.
// Mounted at /api/admin/comments in server.js.
//
// Endpoints:
//   GET    /api/admin/comments        -> list all comments across all artists
//   DELETE /api/admin/comments/:id    -> delete a single comment by comment id

const express = require("express");
const router = express.Router();

const { getAllArtists, deleteComment } = require("./db");

// Simple admin-key guard (same as admin.artists)
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

// Helper to flatten all comments across artists
function getAllCommentsFlat() {
  const artists = getAllArtists();
  const out = [];

  for (const artist of artists) {
    for (const comment of artist.comments || []) {
      out.push({
        ...comment,
        artistId: artist.id,
        artistName: artist.name,
      });
    }
  }

  return out;
}

// GET /api/admin/comments
// List all comments across all artists
router.get("/", adminGuard, (req, res) => {
  try {
    const comments = getAllCommentsFlat();

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
// Delete a single comment by id
router.delete("/:id", adminGuard, (req, res) => {
  try {
    const { id } = req.params;
    const removed = deleteComment(id);

    if (!removed) {
      return res.status(404).json({
        success: false,
        message: "Comment not found.",
        id,
      });
    }

    return res.json({
      success: true,
      deleted: removed,
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