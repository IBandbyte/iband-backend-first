// comments.js
// Public comments API for iBand
// Uses CommentsStore as the single source of truth

const express = require("express");
const router = express.Router();

const CommentsStore = require("./CommentsStore");

// ---------- Create comment ----------
// POST /api/comments
router.post("/", (req, res) => {
  try {
    const { artistId, author, text } = req.body || {};
    const comment = CommentsStore.create({ artistId, author, text });

    res.status(201).json({
      success: true,
      message: "Comment created successfully",
      comment,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
});

// ---------- List comments by artist ----------
// GET /api/comments/by-artist/:artistId
router.get("/by-artist/:artistId", (req, res) => {
  const { artistId } = req.params;
  const comments = CommentsStore.getByArtist(artistId);

  res.json({
    success: true,
    artistId: String(artistId),
    count: comments.length,
    comments,
  });
});

module.exports = router;