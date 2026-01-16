// comments.js (ESM)
// Public comments API
//
// Option A upgrade:
// - Public only sees comments that are NOT hidden
// - Default allowed statuses: visible, approved
// - Pending is not shown publicly (but exists for moderation workflows)

import express from "express";
import commentsStore from "./commentsStore.js";

const router = express.Router();

/**
 * Helpers
 */
function asString(v) {
  return String(v ?? "").trim();
}

function isPublicVisible(comment) {
  // Public visibility rules:
  // - show: visible, approved
  // - hide: hidden, pending (pending is for moderation queues)
  const s = String(comment?.status || "").toLowerCase();
  return s === "visible" || s === "approved";
}

/**
 * POST /api/comments
 * Create a new comment (public)
 *
 * NOTE:
 * - We create as "visible" by default in commentsStore
 * - If you later want anti-spam / moderation, you can set default status to "pending"
 *   in commentsStore.create() and the public feed will auto-hide until approved.
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

    const created = commentsStore.create({ artistId, author, text });

    // Return created comment to creator (even if later changed to pending in store)
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
 * List comments for an artist (PUBLIC SAFE)
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