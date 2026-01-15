// adminComments.js
// Admin comments router (ESM)
// - GET  /api/admin/comments?status=... -> list comments (supports filters)
// - POST /api/admin/comments/bulk-status -> bulk moderation

import express from "express";
import commentsStore from "./commentsStore.js";

const router = express.Router();

// Hard-safe allowed statuses (avoids boot crashes if any export changes)
const ALLOWED_COMMENT_STATUSES = ["pending", "approved", "rejected"];

// --------------------
// GET /api/admin/comments?status=pending|approved|rejected&artistId=1&q=hello&limit=200&offset=0
// --------------------
router.get("/comments", (req, res) => {
  try {
    const status = (req.query.status ?? "").toString().trim() || null;
    const artistId = (req.query.artistId ?? "").toString().trim() || null;
    const q = (req.query.q ?? "").toString().trim() || null;
    const limit = req.query.limit;
    const offset = req.query.offset;

    const result = commentsStore.listAdmin({
      status,
      artistId,
      q,
      limit,
      offset,
    });

    if (!result?.ok) {
      return res.status(result?.status || 400).json({
        success: false,
        message: result?.message || "Bad request",
        allowedStatuses: ALLOWED_COMMENT_STATUSES,
      });
    }

    return res.status(200).json({
      success: true,
      count: result.count,
      limit: result.limit,
      offset: result.offset,
      comments: Array.isArray(result.comments) ? result.comments : [],
      allowedStatuses: ALLOWED_COMMENT_STATUSES,
    });
  } catch (e) {
    console.error("ADMIN_COMMENTS_LIST_ERROR", e?.message || e);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// --------------------
// POST /api/admin/comments/bulk-status
// Body: { ids: ["..."], status: "approved|rejected|pending", moderatedBy?: "Captain", moderationNote?: "..." }
// --------------------
router.post("/comments/bulk-status", (req, res) => {
  try {
    const { ids, status, moderatedBy, moderationNote } = req.body ?? {};

    const result = commentsStore.bulkUpdateStatus({
      ids,
      status,
      moderatedBy,
      moderationNote,
    });

    if (!result?.ok) {
      return res.status(result?.status || 400).json({
        success: false,
        message: result?.message || "Bad request",
        allowedStatuses: ALLOWED_COMMENT_STATUSES,
      });
    }

    return res.status(200).json({
      success: true,
      status: result.status,
      updated: result.updated,
      updatedIds: result.updatedIds,
      missing: result.missing,
      missingIds: result.missingIds,
      moderatedBy: moderatedBy || null,
      moderationNote: moderationNote || null,
    });
  } catch (e) {
    console.error("ADMIN_COMMENTS_BULK_STATUS_ERROR", e?.message || e);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;