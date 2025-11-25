// src/comments.js
// iBand - Comments Router (mounted at /comments)
// Includes pagination, sorting and admin moderation views.

const express = require("express");
const mongoose = require("mongoose");
const Comment = require("../models/commentModel");

const router = express.Router();

// Small helper to validate Mongo IDs
function validateObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Map simple sort keywords to Mongo sort objects
function getSort(sortKey) {
  switch ((sortKey || "").toLowerCase()) {
    case "oldest":
      return { createdAt: 1 };
    case "top":
      // "Top" = most likes, then newest
      return { likeCount: -1, createdAt: -1 };
    case "pinned":
      // Pinned first, then likes, then newest
      return { isPinned: -1, likeCount: -1, createdAt: -1 };
    case "newest":
    default:
      return { createdAt: -1 };
  }
}

// Basic pagination parser
function parsePagination(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limitRaw = parseInt(query.limit, 10) || 20;
  const limit = Math.min(Math.max(limitRaw, 1), 100); // clamp 1–100
  return { page, limit, skip: (page - 1) * limit };
}

// -------------------------
// Admin protection
// -------------------------

function requireAdmin(req, res, next) {
  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey) {
    console.warn("⚠️ ADMIN_KEY is not set in environment.");
    return res
      .status(500)
      .json({ error: "Server misconfigured: ADMIN_KEY not set" });
  }

  const provided = req.headers["x-admin-key"];

  if (!provided || provided !== adminKey) {
    return res.status(401).json({ error: "Unauthorized: invalid admin key" });
  }

  return next();
}

// ---------------------------------------------------------
// 👑 Admin views
// Base path: /comments/admin
// ---------------------------------------------------------

// GET /comments/admin
// List comments across all artists with filters + pagination
router.get("/admin", requireAdmin, async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { artistId, status, isDeleted, search, sort = "newest" } = req.query;

    const filter = {};

    if (artistId && validateObjectId(artistId)) {
      filter.artistId = artistId;
    }

    if (status) {
      filter.status = status;
    }

    if (typeof isDeleted !== "undefined") {
      filter.isDeleted =
        isDeleted === "true" || isDeleted === "1" || isDeleted === true;
    }

    if (search && search.trim()) {
      filter.content = { $regex: search.trim(), $options: "i" };
    }

    const sortObj = getSort(sort);

    const [total, comments] = await Promise.all([
      Comment.countDocuments(filter),
      Comment.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const totalPages = total > 0 ? Math.ceil(total / limit) : 1;

    return res.json({
      meta: {
        page,
        limit,
        total,
        totalPages,
        sort,
        filters: { artistId: filter.artistId || null, status, isDeleted },
      },
      data: comments,
    });
  } catch (err) {
    console.error("Error in admin list comments:", err);
    return res
      .status(500)
      .json({ error: "Server error fetching comments (admin)" });
  }
});

// PATCH /comments/admin/:commentId/status
// Update status / soft-delete / pin from admin panel
router.patch("/admin/:commentId/status", requireAdmin, async (req, res) => {
  try {
    const { commentId } = req.params;

    if (!validateObjectId(commentId)) {
      return res.status(400).json({ error: "Invalid commentId" });
    }

    const {
      status, // "visible" | "hidden" | "blocked" | "flagged"
      isDeleted,
      isPinned,
    } = req.body || {};

    const update = {};

    if (status) {
      update.status = status;
    }

    if (typeof isDeleted !== "undefined") {
      update.isDeleted =
        isDeleted === true ||
        isDeleted === "true" ||
        isDeleted === "1" ||
        isDeleted === 1;

      if (update.isDeleted) {
        update.deletedAt = new Date();
        update.content = "[deleted]";
      } else {
        update.deletedAt = null;
      }
    }

    if (typeof isPinned !== "undefined") {
      update.isPinned =
        isPinned === true ||
        isPinned === "true" ||
        isPinned === "1" ||
        isPinned === 1;
    }

    if (Object.keys(update).length === 0) {
      return res
        .status(400)
        .json({ error: "No valid moderation fields provided" });
    }

    const updated = await Comment.findByIdAndUpdate(commentId, update, {
      new: true,
    });

    if (!updated) {
      return res.status(404).json({ error: "Comment not found" });
    }

    return res.json(updated);
  } catch (err) {
    console.error("Error in admin status update:", err);
    return res
      .status(500)
      .json({ error: "Server error updating comment status" });
  }
});

// ---------------------------------------------------------
// 1️⃣ Create a new comment for an artist
// POST /comments/:artistId
// ---------------------------------------------------------
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
    });

    await comment.save();

    // If this is a reply, bump parent replyCount
    if (parentId && validateObjectId(parentId)) {
      await Comment.findByIdAndUpdate(parentId, { $inc: { replyCount: 1 } });
    }

    return res.status(201).json(comment);
  } catch (err) {
    console.error("Error creating comment:", err);
    return res.status(500).json({ error: "Server error creating comment" });
  }
});

// ---------------------------------------------------------
// 2️⃣ Get comments for an artist (with pagination + sorting)
// GET /comments/:artistId?page=1&limit=20&sort=newest|oldest|top|pinned
// ---------------------------------------------------------
router.get("/:artistId", async (req, res) => {
  try {
    const { artistId } = req.params;

    if (!validateObjectId(artistId)) {
      return res.status(400).json({ error: "Invalid artistId" });
    }

    const { page, limit, skip } = parsePagination(req.query);
    const sort = req.query.sort || "newest";
    const sortObj = getSort(sort);

    const filter = {
      artistId,
      isDeleted: false,
    };

    const [total, comments] = await Promise.all([
      Comment.countDocuments(filter),
      Comment.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const totalPages = total > 0 ? Math.ceil(total / limit) : 1;

    return res.json({
      meta: {
        artistId,
        page,
        limit,
        total,
        totalPages,
        sort,
      },
      data: comments,
    });
  } catch (err) {
    console.error("Error fetching comments:", err);
    return res.status(500).json({ error: "Server error fetching comments" });
  }
});

// ---------------------------------------------------------
// 3️⃣ Like a comment
// PATCH /comments/like/:commentId
// ---------------------------------------------------------
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

// ---------------------------------------------------------
// 4️⃣ Flag a comment
// PATCH /comments/flag/:commentId
// ---------------------------------------------------------
router.patch("/flag/:commentId", async (req, res) => {
  try {
    const { commentId } = req.params;
    const { type = "other", reason = null, reporterId = null } = req.body || {};

    if (!validateObjectId(commentId)) {
      return res.status(400).json({ error: "Invalid commentId" });
    }

    const updated = await Comment.findByIdAndUpdate(
      commentId,
      {
        status: "flagged",
        $push: {
          flags: {
            type,
            reason,
            reporterId,
          },
        },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Comment not found" });
    }

    return res.json(updated);
  } catch (err) {
    console.error("Error flagging comment:", err);
    return res.status(500).json({ error: "Server error flagging comment" });
  }
});

// ---------------------------------------------------------
// 5️⃣ Soft delete a comment (user-level)
// DELETE /comments/:commentId
// ---------------------------------------------------------
router.delete("/:commentId", async (req, res) => {
  try {
    const { commentId } = req.params;

    if (!validateObjectId(commentId)) {
      return res.status(400).json({ error: "Invalid commentId" });
    }

    const updated = await Comment.findByIdAndUpdate(
      commentId,
      {
        isDeleted: true,
        content: "[deleted]",
        deletedAt: new Date(),
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Comment not found" });
    }

    return res.json(updated);
  } catch (err) {
    console.error("Error deleting comment:", err);
    return res.status(500).json({ error: "Server error deleting comment" });
  }
});

module.exports = router;