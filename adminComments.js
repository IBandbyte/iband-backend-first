import express from "express";
import commentsStore, { ALLOWED_COMMENT_STATUSES } from "./commentsStore.js";

const router = express.Router();

/**
 * ADMIN: list all comments (optionally filter)
 * GET /api/admin/comments?status=pending|approved|rejected&artistId=1
 */
router.get("/", (req, res) => {
  try {
    const { status, artistId } = req.query;

    let all = commentsStore.getAll(); // always returns array (hardened in store)
    if (artistId !== undefined) {
      all = all.filter((c) => String(c.artistId) === String(artistId));
    }
    if (status !== undefined) {
      all = all.filter((c) => String(c.status) === String(status));
    }

    return res.status(200).json({
      success: true,
      count: all.length,
      comments: all,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

/**
 * ADMIN: delete one comment
 * DELETE /api/admin/comments/:id
 */
router.delete("/:id", (req, res) => {
  try {
    const id = String(req.params.id);
    const deleted = commentsStore.remove(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }

    return res.status(200).json({ success: true, message: "Comment deleted successfully", deleted });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

/**
 * ADMIN: bulk update moderation status
 * POST /api/admin/comments/bulk-status
 * Body: { ids: ["1","2"], status: "approved"|"rejected"|"pending", moderatedBy?: "Captain" }
 */
router.post("/bulk-status", (req, res) => {
  try {
    const { ids, status, moderatedBy } = req.body || {};

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "ids must be a non-empty array" });
    }

    if (!ALLOWED_COMMENT_STATUSES.includes(String(status))) {
      return res.status(400).json({
        success: false,
        message: `Invalid status value. Allowed: ${ALLOWED_COMMENT_STATUSES.join(", ")}`,
      });
    }

    const result = commentsStore.bulkSetStatus(ids.map(String), String(status), moderatedBy ? String(moderatedBy) : null);

    return res.status(200).json({
      success: true,
      status: String(status),
      updatedCount: result.updatedCount,
      notFoundIds: result.notFoundIds,
      updated: result.updated,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;