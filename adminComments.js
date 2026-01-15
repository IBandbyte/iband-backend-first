// adminComments.js
// Admin comments router (ESM)
// Mounted under /api/admin via admin.js
//
// GET  /api/admin/comments
// POST /api/admin/comments/bulk-status
//
// DEPLOY-SAFE:
// - Does not hard-crash if commentsStore.js changes its named exports.
// - Falls back to a safe default status list.

import express from "express";
import commentsStore from "./commentsStore.js";
import * as commentsStoreModule from "./commentsStore.js";

const router = express.Router();

const SAFE_STATUSES = ["pending", "approved", "rejected"];
const ALLOWED_COMMENT_STATUSES =
  Array.isArray(commentsStoreModule.ALLOWED_COMMENT_STATUSES) &&
  commentsStoreModule.ALLOWED_COMMENT_STATUSES.length > 0
    ? commentsStoreModule.ALLOWED_COMMENT_STATUSES
    : SAFE_STATUSES;

const toStr = (v) => String(v ?? "").trim();

// --------------------
// GET /api/admin/comments
// Query: status, artistId, q, limit, offset
// --------------------
router.get("/comments", (req, res) => {
  try {
    const status = toStr(req.query.status || "") || null;
    const artistId = toStr(req.query.artistId || "") || null;
    const q = toStr(req.query.q || "") || null;

    const limitRaw = req.query.limit;
    const offsetRaw = req.query.offset;

    const limit = limitRaw != null ? Number(limitRaw) : 200;
    const offset = offsetRaw != null ? Number(offsetRaw) : 0;

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
      comments: result.comments,
      allowedStatuses: ALLOWED_COMMENT_STATUSES,
    });
  } catch (_e) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// --------------------
// POST /api/admin/comments/bulk-status
// Body: { ids: [], status: "approved|rejected|pending", moderatedBy, moderationNote }
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
      moderatedBy: moderatedBy ?? null,
      moderationNote: moderationNote ?? null,
    });
  } catch (_e) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;