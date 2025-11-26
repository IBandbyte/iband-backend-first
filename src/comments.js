// src/comments.js
// iBand - Comments Router
// Mounted by server.js at /comments
//
// Includes:
// - Public endpoints (create, list, like, flag, soft delete)
// - Artist-level pagination & sorting
// - Admin dashboard listing with filters/pagination
// - Admin moderation actions (approve, reject, restore, hard delete, bulk)

const express = require("express");
const mongoose = require("mongoose");
const Comment = require("../models/commentModel");

const router = express.Router();

// Small helper to validate Mongo ObjectId strings
function validateObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Helper: parse integer query params with defaults
function parsePositiveInt(value, defaultValue) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n <= 0) return defaultValue;
  return n;
}

// Sorting helper for comments
function buildSort(sortParam) {
  const sort = (sortParam || "").toLowerCase();

  switch (sort) {
    case "oldest":
      return { createdAt: 1 };
    case "popular":
      // Highest likes first, then newest
      return { likeCount: -1, createdAt: -1 };
    case "newest":
    default:
      return { createdAt: -1 };
  }
}

// Admin key middleware
function requireAdminKey(req, res, next) {
  const headerKey = req.header("x-admin-key");
  const expected = process.env.ADMIN_KEY;

  if (!expected) {
    console.warn("ADMIN_KEY is not set in environment variables.");
  }

  if (!headerKey || headerKey !== expected) {
    return res
      .status(401)
      .json({ error: "Unauthorized: invalid admin key" });
  }

  return next();
}

// ---------------------------------------------------------------------
// 1️⃣ Create a new comment for an artist
// POST /comments/:artistId
// Body: { content, userDisplayName?, userId?, parentId?, ... }
// ---------------------------------------------------------------------
router.post("/:artistId", async (req, res) => {
  try {
    const { artistId } = req.params;

    const {
      content,
      parentId = null,
      userId = null,
      userDisplayName = "Anonymous",
      userAvatarUrl = null,
      ipAddress = null,
      userAgent = null,
      deviceId = null,
    } = req.body || {};

    if (!validateObjectId(artistId)) {
      return res.status(400).json({ error: "Invalid artistId" });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Content is required" });
    }

    const comment = new Comment({
      artistId,
      content: content.trim(),
      parentId,
      userId,
      userDisplayName,
      userAvatarUrl,
      ipAddress,
      userAgent,
      deviceId,
      status: "visible",
      isDeleted: false,
    });

    await comment.save();

    // If this is a reply, bump parent replyCount
    if (parentId && validateObjectId(parentId)) {
      await Comment.findByIdAndUpdate(parentId, {
        $inc: { replyCount: 1 },
      });
    }

    return res.status(201).json(comment);
  } catch (err) {
    console.error("Error creating comment:", err);
    return res.status(500).json({ error: "Server error creating comment" });
  }
});

// ---------------------------------------------------------------------
// 2️⃣ Get comments for an artist (with pagination & sorting)
// GET /comments/:artistId
//
// Query params:
//   page?  (default 1)
//   limit? (default 10)
//   sort?  = newest | oldest | popular
//
// Response:
//   { meta: { artistId, page, limit, total, totalPages, sort }, data: [...] }
// ---------------------------------------------------------------------
router.get("/:artistId", async (req, res) => {
  try {
    const { artistId } = req.params;

    if (!validateObjectId(artistId)) {
      return res.status(400).json({ error: "Invalid artistId" });
    }

    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 10);
    const sortParam = req.query.sort || "newest";
    const sort = buildSort(sortParam);

    const filter = {
      artistId,
      isDeleted: false,
      status: "visible",
    };

    const total = await Comment.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const skip = (page - 1) * limit;

    const comments = await Comment.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    return res.json({
      meta: {
        artistId,
        page,
        limit,
        total,
        totalPages,
        sort: sortParam,
      },
      data: comments,
    });
  } catch (err) {
    console.error("Error fetching comments:", err);
    return res.status(500).json({ error: "Server error fetching comments" });
  }
});

// ---------------------------------------------------------------------
// 3️⃣ Like a comment
// PATCH /comments/like/:commentId
// ---------------------------------------------------------------------
router.patch("/like/:commentId", async (req, res) => {
  try {
    const { commentId } = req.params;

    if (!validateObjectId(commentId)) {
      return res.status(400).json({ error: "Invalid commentId" });
    }

    const updated = await Comment.findByIdAndUpdate(
      commentId,
      { $inc: { likeCount: 1 } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Comment not found" });
    }

    return res.json(updated);
  } catch (err) {
    console.error("Error liking comment:", err);
    return res.status(500).json({ error: "Server error liking comment" });
  }
});

// ---------------------------------------------------------------------
// 4️⃣ Flag a comment
// PATCH /comments/flag/:commentId
// Body: { type?, reason?, reporterId? }
// ---------------------------------------------------------------------
router.patch("/flag/:commentId", async (req, res) => {
  try {
    const { commentId } = req.params;
    const { type = "other", reason = null, reporterId = null } =
      req.body || {};

    if (!validateObjectId(commentId)) {
      return res.status(400).json({ error: "Invalid commentId" });
    }

    const update = {
      status: "flagged",
      $push: {
        flags: {
          type,
          reason,
          reporterId,
        },
      },
    };

    const updated = await Comment.findByIdAndUpdate(commentId, update, {
      new: true,
    });

    if (!updated) {
      return res.status(404).json({ error: "Comment not found" });
    }

    return res.json(updated);
  } catch (err) {
    console.error("Error flagging comment:", err);
    return res.status(500).json({ error: "Server error flagging comment" });
  }
});

// ---------------------------------------------------------------------
// 5️⃣ Soft delete a comment (user-level / public)
// DELETE /comments/:commentId
// Marks as deleted, keeps record for admin review
// ---------------------------------------------------------------------
router.delete("/:commentId", async (req, res) => {
  try {
    const { commentId } = req.params;

    if (!validateObjectId(commentId)) {
      return res.status(400).json({ error: "Invalid commentId" });
    }

    const update = {
      isDeleted: true,
      status: "deleted",
      content: "[deleted]",
      deletedAt: new Date(),
    };

    const updated = await Comment.findByIdAndUpdate(commentId, update, {
      new: true,
    });

    if (!updated) {
      return res.status(404).json({ error: "Comment not found" });
    }

    return res.json(updated);
  } catch (err) {
    console.error("Error deleting comment:", err);
    return res.status(500).json({ error: "Server error deleting comment" });
  }
});

// =====================================================================
// 🛡 Admin section (requires x-admin-key header)
// =====================================================================

// ---------------------------------------------------------------------
// 6️⃣ Admin list of comments with filters/pagination
// GET /comments/admin
//
// Headers:
//   x-admin-key: <ADMIN_KEY>
//
// Query:
//   status?   = visible | pending | flagged | deleted | rejected | all
//   artistId? = specific artist
//   page?     (default 1)
//   limit?    (default 20)
//   sort?     = newest | oldest | popular
// ---------------------------------------------------------------------
router.get("/admin", requireAdminKey, async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 20);
    const sortParam = req.query.sort || "newest";
    const sort = buildSort(sortParam);

    const status = (req.query.status || "all").toLowerCase();
    const artistId = req.query.artistId || null;

    const filter = {};

    if (status !== "all") {
      filter.status = status;
    }

    if (artistId) {
      filter.artistId = artistId;
    }

    const total = await Comment.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const skip = (page - 1) * limit;

    const comments = await Comment.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    return res.json({
      meta: {
        page,
        limit,
        total,
        totalPages,
        sort: sortParam,
        filters: {
          artistId: artistId || null,
          status,
        },
      },
      data: comments,
    });
  } catch (err) {
    console.error("Error in admin comments list:", err);
    return res.status(500).json({ error: "Server error in admin listing" });
  }
});

// Convenience wrappers for specific status views
// GET /comments/admin/flagged
router.get("/admin/flagged", requireAdminKey, (req, res, next) => {
  req.query.status = "flagged";
  return router.handle(req, res, next);
});

// GET /comments/admin/deleted
router.get("/admin/deleted", requireAdminKey, (req, res, next) => {
  req.query.status = "deleted";
  return router.handle(req, res, next);
});

// GET /comments/admin/pending
router.get("/admin/pending", requireAdminKey, (req, res, next) => {
  req.query.status = "pending";
  return router.handle(req, res, next);
});

// NOTE: The three helpers above reuse the main /admin handler via router.handle.
// Hoppscotch-wise, you can also just hit /comments/admin?status=flagged, etc.

// ---------------------------------------------------------------------
// 7️⃣ Admin approve a comment
// PATCH /comments/admin/approve/:commentId
// ---------------------------------------------------------------------
router.patch(
  "/admin/approve/:commentId",
  requireAdminKey,
  async (req, res) => {
    try {
      const { commentId } = req.params;

      if (!validateObjectId(commentId)) {
        return res.status(400).json({ error: "Invalid commentId" });
      }

      const update = {
        status: "visible",
        isDeleted: false,
        deletedAt: null,
      };

      const updated = await Comment.findByIdAndUpdate(commentId, update, {
        new: true,
      });

      if (!updated) {
        return res.status(404).json({ error: "Comment not found" });
      }

      return res.json(updated);
    } catch (err) {
      console.error("Error approving comment:", err);
      return res.status(500).json({ error: "Server error approving comment" });
    }
  }
);

// ---------------------------------------------------------------------
// 8️⃣ Admin reject a comment
// PATCH /comments/admin/reject/:commentId
// Optional body: { reason?: string } – for future audit logs
// ---------------------------------------------------------------------
router.patch(
  "/admin/reject/:commentId",
  requireAdminKey,
  async (req, res) => {
    try {
      const { commentId } = req.params;

      if (!validateObjectId(commentId)) {
        return res.status(400).json({ error: "Invalid commentId" });
      }

      const update = {
        status: "rejected",
        isDeleted: false,
        deletedAt: null,
      };

      const updated = await Comment.findByIdAndUpdate(commentId, update, {
        new: true,
      });

      if (!updated) {
        return res.status(404).json({ error: "Comment not found" });
      }

      return res.json(updated);
    } catch (err) {
      console.error("Error rejecting comment:", err);
      return res.status(500).json({ error: "Server error rejecting comment" });
    }
  }
);

// ---------------------------------------------------------------------
// 9️⃣ Admin restore a previously soft-deleted comment
// PATCH /comments/admin/restore/:commentId
// (Note: content will still be "[deleted]" if soft delete overwrote it.)
// ---------------------------------------------------------------------
router.patch(
  "/admin/restore/:commentId",
  requireAdminKey,
  async (req, res) => {
    try {
      const { commentId } = req.params;

      if (!validateObjectId(commentId)) {
        return res.status(400).json({ error: "Invalid commentId" });
      }

      const update = {
        isDeleted: false,
        status: "visible",
        deletedAt: null,
      };

      const updated = await Comment.findByIdAndUpdate(commentId, update, {
        new: true,
      });

      if (!updated) {
        return res.status(404).json({ error: "Comment not found" });
      }

      return res.json(updated);
    } catch (err) {
      console.error("Error restoring comment:", err);
      return res.status(500).json({ error: "Server error restoring comment" });
    }
  }
);

// ---------------------------------------------------------------------
// 🔟 Admin HARD delete (permanent)
// DELETE /comments/admin/hard/:commentId
// ---------------------------------------------------------------------
router.delete(
  "/admin/hard/:commentId",
  requireAdminKey,
  async (req, res) => {
    try {
      const { commentId } = req.params;

      if (!validateObjectId(commentId)) {
        return res.status(400).json({ error: "Invalid commentId" });
      }

      const existing = await Comment.findById(commentId);

      if (!existing) {
        return res.status(404).json({ error: "Comment not found" });
      }

      await Comment.deleteOne({ _id: commentId });

      return res.json({ success: true });
    } catch (err) {
      console.error("Error hard deleting comment:", err);
      return res
        .status(500)
        .json({ error: "Server error hard deleting comment" });
    }
  }
);

// ---------------------------------------------------------------------
// 1️⃣1️⃣ Admin bulk moderation
// POST /comments/admin/bulk
//
// Body:
//   {
//     "action": "approve" | "reject" | "delete" | "restore" | "hard-delete",
//     "ids": ["...", "..."]
//   }
//
// Returns: { success: true, action, matched, modified, deleted? }
// ---------------------------------------------------------------------
router.post("/admin/bulk", requireAdminKey, async (req, res) => {
  try {
    const { action, ids } = req.body || {};

    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ error: "ids must be a non-empty array" });
    }

    const validIds = ids.filter((id) => validateObjectId(id));

    if (validIds.length === 0) {
      return res
        .status(400)
        .json({ error: "No valid comment IDs provided" });
    }

    let result;

    switch (action) {
      case "approve":
        result = await Comment.updateMany(
          { _id: { $in: validIds } },
          { status: "visible", isDeleted: false, deletedAt: null }
        );
        break;

      case "reject":
        result = await Comment.updateMany(
          { _id: { $in: validIds } },
          { status: "rejected", isDeleted: false, deletedAt: null }
        );
        break;

      case "restore":
        result = await Comment.updateMany(
          { _id: { $in: validIds } },
          { status: "visible", isDeleted: false, deletedAt: null }
        );
        break;

      case "delete":
        result = await Comment.updateMany(
          { _id: { $in: validIds } },
          {
            status: "deleted",
            isDeleted: true,
            content: "[deleted]",
            deletedAt: new Date(),
          }
        );
        break;

      case "hard-delete":
        result = await Comment.deleteMany({ _id: { $in: validIds } });
        break;

      default:
        return res
          .status(400)
          .json({ error: "Invalid action for bulk moderation" });
    }

    return res.json({
      success: true,
      action,
      matched: result.matchedCount ?? result.n ?? undefined,
      modified: result.modifiedCount ?? result.nModified ?? undefined,
      deleted: result.deletedCount ?? undefined,
    });
  } catch (err) {
    console.error("Error in bulk moderation:", err);
    return res
      .status(500)
      .json({ error: "Server error in bulk moderation" });
  }
});

module.exports = router;