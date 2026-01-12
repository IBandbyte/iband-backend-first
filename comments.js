// comments.js (ESM)
// Public comments routes: create comment + list APPROVED comments by artist only (Option B).

import express from "express";
import commentsStore from "./commentsStore.js";

const router = express.Router();

// POST /api/comments
// Body: { artistId: "1", author: "Name", text: "Hello" }
router.post("/", (req, res) => {
  try {
    const { artistId, author, text } = req.body || {};
    const result = commentsStore.create({ artistId, author, text });

    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.error });
    }

    return res.status(201).json({
      success: true,
      message: "Comment created successfully.",
      comment: result.comment
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /api/comments/by-artist/:artistId
// Public: ONLY APPROVED comments returned.
router.get("/by-artist/:artistId", (req, res) => {
  try {
    const { artistId } = req.params;

    const result = commentsStore.listPublicByArtist({ artistId });
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.error });
    }

    return res.status(200).json({
      success: true,
      artistId: String(artistId),
      count: result.comments.length,
      comments: result.comments
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// GET /api/comments/statuses
// Helpful for Hoppscotch + UI: what statuses exist
router.get("/statuses", (req, res) => {
  return res.status(200).json({
    success: true,
    statuses: commentsStore.ALLOWED_STATUSES
  });
});

export default router;