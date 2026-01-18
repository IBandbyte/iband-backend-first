// comments.js (ESM)
// Public comments API — Option A (aligned with commentsStore.js)
//
// Public rules:
// - Anyone can POST a comment (defaults to "pending")
// - Public feed shows ONLY: approved OR visible
// - Pending / hidden / rejected are NOT shown publicly

import express from "express";
import commentsStore from "./commentsStore.js";

const router = express.Router();

/* -------------------- Helpers -------------------- */

const asString = (v) => String(v ?? "").trim();

function isPublicVisible(comment) {
  const s = String(comment?.status || "").toLowerCase();
  return s === "approved" || s === "visible";
}

/* -------------------- Routes -------------------- */

/**
 * POST /api/comments
 * Create comment (public)
 */
router.post("/", (req, res) => {
  try {
    const artistId = asString(req.body?.artistId);
    const author = asString(req.body?.author);
    const text = asString(req.body?.text);

    const created = commentsStore.create({ artistId, author, text });

    return res.status(201).json({
      success: true,
      message: "Comment created successfully.",
      comment: created,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err?.message || "Invalid request.",
    });
  }
});

/**
 * GET /api/comments/by-artist/:artistId
 * List comments for artist (public-safe)
 */
router.get("/by-artist/:artistId", (req, res) => {
  const artistId = asString(req.params.artistId);

  const comments = commentsStore
    .getByArtistId(artistId)
    .filter(isPublicVisible);

  return res.status(200).json({
    success: true,
    artistId,
    count: comments.length,
    comments,
  });
});

export default router;