// adminComments.js
import express from "express";
import commentsStore, { ALLOWED_COMMENT_STATUSES } from "./commentsStore.js";

const router = express.Router();

// GET /api/admin/comments?status=pending|approved|rejected
router.get("/comments", (req, res) => {
  try {
    const status = (req.query.status ?? "").toString().trim();
    const result = commentsStore.getAll({ status });

    if (!result.success) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.message || "Bad request",
        allowedStatuses: ALLOWED_COMMENT_STATUSES,
      });
    }

    return res.status(200).json({
      success: true,
      count: result.comments.length,
      comments: result.comments,
      allowedStatuses: ALLOWED_COMMENT_STATUSES,
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /api/admin/comments/bulk-status
router.post("/comments/bulk-status", (req, res) => {
  try {
    const { ids, status, moderatedBy } = req.body ?? {};
    const result = commentsStore.bulkUpdateStatus({ ids, status, moderatedBy });

    if (!result.success) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.message || "Bad request",
        allowedStatuses: ALLOWED_COMMENT_STATUSES,
      });
    }

    return res.status(200).json({
      success: true,
      status: result.statusSetTo,
      updatedCount: result.updatedCount,
      moderatedBy: result.moderatedBy,
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;