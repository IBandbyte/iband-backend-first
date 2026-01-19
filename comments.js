// comments.js (ESM)
// Public comments API (Option A - LOCKED)
//
// Canonical statuses (from commentsStore.js):
// - pending   (NOT public)
// - approved  (public)
// - hidden    (NOT public)
// - rejected  (NOT public)
//
// Public endpoints:
// - POST /api/comments
// - GET  /api/comments/by-artist/:artistId

import express from "express";
import commentsStore from "./commentsStore.js";

const router = express.Router();

const asString = (v) => String(v ?? "").trim();

function isPublicVisible(comment) {
  // Option A rule: ONLY approved comments are public
  return String(comment?.status ?? "").toLowerCase() === "approved";
}

/**
 * POST /api/comments
 * Create a comment (public)
 *
 * Option A:
 * - Always creates as "pending" (store default)
 * - Public list hides pending until admin approves
 */
router.post("/", (req, res) => {
  try {
    const artistId = asString(req.body?.artistId);
    const author = asString(req.body?.author);
    const text = asString(req.body?.text);

    if (!artistId) {
      return res.status(400).json({ success: false, message: "artistId is required" });
    }
    if (!author) {
      return res.status(400).json({ success: false, message: "author is required" });
    }
    if (!text) {
      return res.status(400).json({ success: false, message: "text is required" });
    }

    // store.create throws on invalid input (Step A1)
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
 * List public comments for a given artist
 *
 * Option A: only approved comments show
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