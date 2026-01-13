import express from "express";
import commentsStore, { ALLOWED_COMMENT_STATUSES } from "./commentsStore.js";

const router = express.Router();

/**
 * Helpers
 */
function jsonError(res, statusCode, message, extra = {}) {
  return res.status(statusCode).json({
    success: false,
    message,
    ...extra,
  });
}

function normalizeId(value) {
  if (value === undefined || value === null) return null;
  return String(value).trim();
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * POST /api/comments
 * Create a comment (public)
 */
router.post("/", (req, res) => {
  try {
    const artistId = normalizeId(req.body?.artistId);
    const author = typeof req.body?.author === "string" ? req.body.author.trim() : "";
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";

    if (!artistId) return jsonError(res, 400, "artistId is required");
    if (!isNonEmptyString(author)) return jsonError(res, 400, "author is required");
    if (!isNonEmptyString(text)) return jsonError(res, 400, "text is required");

    const created = commentsStore.create({
      artistId,
      author,
      text,
      // IMPORTANT: in Option B, new comments are NOT public until approved
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Comment created successfully",
      comment: created,
    });
  } catch (err) {
    console.error("POST /api/comments error:", err);
    return jsonError(res, 500, "Internal server error");
  }
});

/**
 * GET /api/comments/by-artist/:artistId
 * Public list for an artist.
 *
 * Option B rule:
 * - Only return comments with status === "approved"
 *
 * FIX:
 * - If there are ZERO approved comments, return 200 with [] (NOT 500).
 */
router.get("/by-artist/:artistId", (req, res) => {
  try {
    const artistId = normalizeId(req.params.artistId);
    if (!artistId) return jsonError(res, 400, "artistId is required");

    // Pull everything we have for artist, then filter public-approved
    const allForArtist = commentsStore.listByArtist(artistId) || [];

    const approved = allForArtist.filter((c) => {
      const status = String(c?.status || "").toLowerCase();
      return status === "approved";
    });

    // ✅ THE FIX: Always return success true, even if approved is empty
    return res.status(200).json({
      success: true,
      artistId,
      count: approved.length,
      comments: approved,
      publicRule: "approved_only",
      allowedStatuses: Array.isArray(ALLOWED_COMMENT_STATUSES)
        ? ALLOWED_COMMENT_STATUSES
        : ["pending", "approved", "rejected"],
    });
  } catch (err) {
    console.error("GET /api/comments/by-artist/:artistId error:", err);
    return jsonError(res, 500, "Internal server error");
  }
});

export default router;