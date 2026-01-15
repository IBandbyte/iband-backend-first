// comments.js
// Public comments router (ESM, Render-safe)
// Routes:
//   POST /api/comments
//   GET  /api/comments/by-artist/:artistId

import express from "express";
import commentsStore from "./commentsStore.js";

const router = express.Router();

/*
 POST /api/comments
 Body: { artistId, author, text }
 Creates a PENDING comment
*/
router.post("/", (req, res) => {
  try {
    const { artistId, author, text } = req.body ?? {};

    const result = commentsStore.create({ artistId, author, text });

    if (!result.ok) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.message,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Comment created successfully",
      comment: result.comment,
    });
  } catch (err) {
    console.error("COMMENTS_POST_ERROR", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

/*
 GET /api/comments/by-artist/:artistId
 Returns APPROVED comments only
 MUST return 200 + [] when none exist
*/
router.get("/by-artist/:artistId", (req, res) => {
  try {
    const { artistId } = req.params;

    const result = commentsStore.listByArtist(artistId, {
      onlyApproved: true,
    });

    if (!result.ok) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.message,
      });
    }

    return res.status(200).json({
      success: true,
      artistId: result.artistId,
      count: result.count,
      comments: result.comments,
    });
  } catch (err) {
    console.error("COMMENTS_GET_ERROR", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;