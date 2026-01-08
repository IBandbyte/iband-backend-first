// admin.js
// iBand backend — admin routes
// Handles admin operations for artists AND comments

const express = require("express");
const router = express.Router();

const ArtistsStore = require("./artistsStore");
const CommentsStore = require("./CommentsStore");

// Optional admin key (dev mode if empty)
const ADMIN_KEY = process.env.ADMIN_KEY || "";

// ---------- Admin auth middleware ----------
function requireAdmin(req, res, next) {
  if (!ADMIN_KEY) return next();

  const key = req.headers["x-admin-key"];
  if (key !== ADMIN_KEY) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: invalid or missing x-admin-key",
    });
  }
  next();
}

// ---------- Admin root ----------
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "iBand admin API is running",
  });
});

// ---------- ARTISTS (admin) ----------

// GET /api/admin/artists
router.get("/artists", requireAdmin, (req, res) => {
  const artists = ArtistsStore.getAllArtists();
  res.json({
    success: true,
    count: artists.length,
    artists,
  });
});

// POST /api/admin/artists
router.post("/artists", requireAdmin, (req, res) => {
  const { name, genre, bio, imageUrl } = req.body || {};
  if (!name) {
    return res.status(400).json({
      success: false,
      message: "name is required",
    });
  }

  const artist = ArtistsStore.createArtist({
    name,
    genre,
    bio,
    imageUrl,
  });

  res.status(201).json({
    success: true,
    artist,
  });
});

// DELETE /api/admin/artists/:id
router.delete("/artists/:id", requireAdmin, (req, res) => {
  const removed = ArtistsStore.deleteArtist(req.params.id);
  if (!removed) {
    return res.status(404).json({
      success: false,
      message: "Artist not found",
    });
  }

  // Also remove comments for this artist
  CommentsStore.deleteByArtist(req.params.id);

  res.json({
    success: true,
    message: "Artist and related comments deleted",
  });
});

// ---------- COMMENTS (admin) ----------

// GET /api/admin/comments
router.get("/comments", requireAdmin, (req, res) => {
  const comments = CommentsStore.getAll();
  res.json({
    success: true,
    count: comments.length,
    comments,
  });
});

// PUT /api/admin/comments/:id
router.put("/comments/:id", requireAdmin, (req, res) => {
  const updated = CommentsStore.update(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({
      success: false,
      message: "Comment not found",
    });
  }

  res.json({
    success: true,
    comment: updated,
  });
});

// PATCH /api/admin/comments/:id
router.patch("/comments/:id", requireAdmin, (req, res) => {
  const updated = CommentsStore.update(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({
      success: false,
      message: "Comment not found",
    });
  }

  res.json({
    success: true,
    comment: updated,
  });
});

// DELETE /api/admin/comments/:id
router.delete("/comments/:id", requireAdmin, (req, res) => {
  const removed = CommentsStore.delete(req.params.id);
  if (!removed) {
    return res.status(404).json({
      success: false,
      message: "Comment not found",
    });
  }

  res.json({
    success: true,
    message: "Comment deleted",
  });
});

// POST /api/admin/comments/reset
router.post("/comments/reset", requireAdmin, (req, res) => {
  const deleted = CommentsStore.reset();
  res.json({
    success: true,
    deleted,
    message: "All comments reset",
  });
});

module.exports = router;