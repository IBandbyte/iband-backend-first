// comments.js (ESM)
// Public comments API — aligned with canonical commentsStore
//
// Public rules:
// - Anyone can POST a comment
// - Public listing only shows APPROVED comments

import express from "express";
import commentsStore from "./commentsStore.js";

const router = express.Router();

/* -------------------- Helpers -------------------- */

const asString = (v) => String(v ?? "").trim();

/* -------------------- Routes -------------------- */

/**
 * POST /api/comments
 * Create a new public comment
 */
router.post("/", (req, res) => {
  try {
    const artistId = asString(req.body?.artistId);
    const author = asString(req.body?.author);
    const text = asString(req.body?.text);

    const created = commentsStore.create({
      artistId,
      author,
      text,
    });

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
 * Public-safe listing (APPROVED only)
 */
router.get("/by-artist/:artistId", (req, res) => {
  const artistId = asString(req.params.artistId);

  const comments = commentsStore.listByArtistId(artistId, {
    onlyApproved: true,
  });

  return res.status(200).json({
    success: true,
    artistId,
    count: comments.length,
    comments,
  });
});

export default router;