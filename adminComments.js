// adminComments.js
// Admin comments router (ESM)

import express from "express";
import commentsStore, {
  ALLOWED_COMMENT_STATUSES,
} from "./commentsStore.js";

const router = express.Router();

// --------------------
// GET /api/admin/comments
// Optional query: ?status=pending|approved|rejected
// --------------------
router.get("/comments", (req, res) => {
  try {
    const { status } = req.query;

    const result = commentsStore.listAdmin({ status });

    if (!result.ok) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.message,
        allowedStatuses: ALLOWED_COMMENT_STATUSES,
      });
    }

    return res.status(200).json({
      success: true,
      count: result.count,
      comments: result.comments,
      allowedStatuses: ALLOWED_COMMENT_STATUSES,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// --------------------
// POST /api/admin/comments/bulk-status
// Body: { ids: [], status, moderatedBy?, moderationNote? }
// --------------------
router.post("/comments/bulk-status", (req, res) => {
  try {
    const result = commentsStore.bulkUpdateStatus(req.body ?? {});

    if (!result.ok) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.message,
        allowedStatuses: ALLOWED_COMMENT_STATUSES,
      });
    }

    return res.status(200).json({
      success: true,
      status: result.status,
      updated: result.updated,
      updatedIds: result.updatedIds,
      missingIds: result.missingIds,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;