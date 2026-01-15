// adminComments.js
// Admin comments router (ESM)
// Mount at: /api/admin
// Routes:
//   GET  /api/admin/comments?status=pending|approved|rejected&artistId=1&q=...&limit=200&offset=0
//   POST /api/admin/comments/bulk-status

import express from "express";
import commentsStore, { ALLOWED_COMMENT_STATUSES } from "./commentsStore.js";

const router = express.Router();

/**
 * Minimal admin auth (future-proof):
 * - Accepts x-admin-key header
 * - Compares with process.env.ADMIN_KEY or process.env.IBAND_ADMIN_KEY
 * - If no env key is set, admin routes still work (dev mode) but warns in response
 */
function requireAdmin(req, res, next) {
  const expected =
    (process.env.IBAND_ADMIN_KEY || process.env.ADMIN_KEY || "").trim();

  // If no key configured, allow (dev mode)
  if (!expected) return next();

  const got = String(req.headers["x-admin-key"] || "").trim();
  if (!got || got !== expected) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: missing/invalid x-admin-key.",
    });
  }
  return next();
}

// --------------------
// GET /api/admin/comments
// --------------------
router.get("/comments", requireAdmin, (req, res) => {
  try {
    const status = (req.query.status ?? "").toString().trim() || null;
    const artistId = (req.query.artistId ?? "").toString().trim() || null;
    const q = (req.query.q ?? "").toString().trim() || null;

    const limit = req.query.limit != null ? Number(req.query.limit) : 200;
    const offset = req.query.offset != null ? Number(req.query.offset) : 0;

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
      // Helpful warning if no admin key set in env (prevents “why is this open?” confusion)
      adminKeyConfigured: Boolean(
        (process.env.IBAND_ADMIN_KEY || process.env.ADMIN_KEY || "").trim()
      ),
    });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
});

// --------------------
// POST /api/admin/comments/bulk-status
// Body: { ids: [], status: "approved", moderatedBy?: "...", moderationNote?: "..." }
// --------------------
router.post("/comments/bulk-status", requireAdmin, (req, res) => {
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
      allowedStatuses: ALLOWED_COMMENT_STATUSES,
      adminKeyConfigured: Boolean(
        (process.env.IBAND_ADMIN_KEY || process.env.ADMIN_KEY || "").trim()
      ),
    });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
});

export default router;