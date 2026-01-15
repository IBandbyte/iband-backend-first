// adminComments.js
// Admin comments router (ESM) - DEPLOY-SAFE
// Works even if commentsStore named exports change.
// Supports BOTH mount styles:
//  - app.use("/api/admin", adminRouter) + adminRouter.use("/", adminCommentsRouter)
//  - adminRouter.use("/comments", adminCommentsRouter)
//
// Endpoints supported (both variants):
//  GET  /api/admin/comments
//  GET  /api/admin/comments?status=pending|approved|rejected
//  POST /api/admin/comments/bulk-status
//
// Also supports:
//  GET  /api/admin/comments/comments (legacy mount)
//  POST /api/admin/comments/comments/bulk-status (legacy mount)

import express from "express";
import commentsStore from "./commentsStore.js";

const router = express.Router();

// Hard fallback (never crash)
const FALLBACK_STATUSES = ["pending", "approved", "rejected"];

function getAllowedStatuses() {
  // If you later decide to expose statuses via store, we’ll pick it up automatically.
  const maybe =
    commentsStore?.ALLOWED_COMMENT_STATUSES ||
    commentsStore?.allowedStatuses ||
    commentsStore?.statuses;
  return Array.isArray(maybe) && maybe.length ? maybe : FALLBACK_STATUSES;
}

// Normalize a store response into a consistent shape
function ok(resObj) {
  return Boolean(resObj && (resObj.ok === true || resObj.success === true));
}

function pickStatusCode(resObj, fallback = 400) {
  return Number(resObj?.status || resObj?.statusCode || fallback);
}

// --------------------
// GET handler
// --------------------
function handleList(req, res) {
  try {
    const status = String(req.query.status ?? "").trim() || null;

    // Prefer new API: listAdmin({ status })
    if (typeof commentsStore?.listAdmin === "function") {
      const result = commentsStore.listAdmin({ status });

      if (!ok(result)) {
        return res.status(pickStatusCode(result, 400)).json({
          success: false,
          message: result.message || "Bad request",
          allowedStatuses: getAllowedStatuses(),
        });
      }

      return res.status(200).json({
        success: true,
        count: Number(result.count || 0),
        limit: result.limit ?? 200,
        offset: result.offset ?? 0,
        comments: Array.isArray(result.comments) ? result.comments : [],
        allowedStatuses: getAllowedStatuses(),
      });
    }

    // Legacy API fallback: getAll({ status })
    if (typeof commentsStore?.getAll === "function") {
      const result = commentsStore.getAll({ status });

      if (!ok(result)) {
        return res.status(pickStatusCode(result, 400)).json({
          success: false,
          message: result.message || "Bad request",
          allowedStatuses: getAllowedStatuses(),
        });
      }

      const comments = Array.isArray(result.comments) ? result.comments : [];
      return res.status(200).json({
        success: true,
        count: comments.length,
        comments,
        allowedStatuses: getAllowedStatuses(),
      });
    }

    // No API available -> safe response
    return res.status(200).json({
      success: true,
      count: 0,
      comments: [],
      allowedStatuses: getAllowedStatuses(),
      warning: "commentsStore missing listAdmin/getAll; returning empty list.",
    });
  } catch (_e) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

// --------------------
// POST handler
// --------------------
function handleBulkStatus(req, res) {
  try {
    const { ids, status, moderatedBy, moderationNote } = req.body ?? {};

    if (typeof commentsStore?.bulkUpdateStatus === "function") {
      const result = commentsStore.bulkUpdateStatus({
        ids,
        status,
        moderatedBy,
        moderationNote,
      });

      if (!ok(result)) {
        return res.status(pickStatusCode(result, 400)).json({
          success: false,
          message: result.message || "Bad request",
          allowedStatuses: getAllowedStatuses(),
        });
      }

      // Normalize response for both new & old shapes
      return res.status(200).json({
        success: true,
        status: result.status || result.statusSetTo || String(status || ""),
        updated: Number(result.updated ?? result.updatedCount ?? 0),
        updatedIds: Array.isArray(result.updatedIds) ? result.updatedIds : [],
        missing: Number(result.missing ?? 0),
        missingIds: Array.isArray(result.missingIds) ? result.missingIds : [],
        moderatedBy: result.moderatedBy ?? moderatedBy ?? null,
        allowedStatuses: getAllowedStatuses(),
      });
    }

    return res.status(501).json({
      success: false,
      message: "bulkUpdateStatus is not implemented in commentsStore.",
      allowedStatuses: getAllowedStatuses(),
    });
  } catch (_e) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * ROUTES
 * We register both route patterns so it works no matter how admin.js mounts this router.
 */

// Common desired paths:
router.get("/comments", handleList);
router.post("/comments/bulk-status", handleBulkStatus);

// Compatibility paths (if mounted at /api/admin/comments already):
router.get("/", handleList);
router.post("/bulk-status", handleBulkStatus);

// Extra legacy compatibility (double /comments in path):
router.get("/comments/comments", handleList);
router.post("/comments/comments/bulk-status", handleBulkStatus);

export default router;