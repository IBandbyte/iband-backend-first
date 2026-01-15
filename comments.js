// comments.js
// Public comments router (ESM)
// - POST /api/comments                 -> create comment (pending)
// - GET  /api/comments/by-artist/:artistId -> list APPROVED comments for artist

import express from "express";
import commentsStore from "./commentsStore.js";

const router = express.Router();

// --------------------
// POST /api/comments
// Body: { artistId, author, text }
// Creates a PENDING comment.
// --------------------
router.post("/", (req, res) => {
  try {
    const { artistId, author, text } = req.body ?? {};

    const result = commentsStore.create({ artistId, author, text });

    if (!result?.ok) {
      return res.status(result?.status || 400).json({
        success: false,
        message: result?.message || "Bad request",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Comment created successfully",
      comment: result.comment,
    });
  } catch (err) {
    console.error("COMMENTS_POST_ERROR", err?.message || err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// --------------------
// GET /api/comments/by-artist/:artistId
// Returns APPROVED comments only.
// MUST return 200 + [] when none exist.
// --------------------
router.get("/by-artist/:artistId", (req, res) => {
  try {
    const { artistId } = req.params;

    const result = commentsStore.listByArtist(artistId, { onlyApproved: true });

    if (!result?.ok) {
      return res.status(result?.status || 400).json({
        success: false,
        message: result?.message || "Bad request",
      });
    }

    const safe = Array.isArray(result.comments) ? result.comments : [];

    return res.status(200).json({
      success: true,
      artistId: result.artistId,
      count: safe.length,
      comments: safe,
    });
  } catch (err) {
    console.error("COMMENTS_GET_BY_ARTIST_ERROR", err?.message || err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;