// src/comments.js
// iBand - Comments Router (mounted by server.js at /comments)
// Public fan endpoints + admin moderation views

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Comment = require('../models/commentModel');

// ------------------------------
// Helpers
// ------------------------------
function validateObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Simple admin auth using header x-admin-key
// For now it checks against process.env.ADMIN_API_KEY or fallback 'mysecret123'
const ADMIN_FALLBACK_KEY = 'mysecret123';

function adminAuth(req, res, next) {
  const headerKey = req.header('x-admin-key');
  const envKey = process.env.ADMIN_API_KEY || ADMIN_FALLBACK_KEY;

  if (!headerKey || headerKey !== envKey) {
    return res.status(401).json({ error: 'Unauthorized: invalid admin key' });
  }

  next();
}

// ------------------------------
// 1️⃣ Public – Create comment for an artist
// POST /comments/:artistId
// ------------------------------
router.post('/:artistId', async (req, res) => {
  try {
    const { artistId } = req.params;
    const {
      content,
      parentId = null,
      userId = null,
      userDisplayName = 'Anonymous',
      userAvatarUrl = null,
      ipAddress = null,
      userAgent = null,
      deviceId = null,
    } = req.body || {};

    if (!validateObjectId(artistId)) {
      return res.status(400).json({ error: 'Invalid artistId' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Content is required' });
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
    console.error('Error creating comment:', err);
    return res.status(500).json({ error: 'Server error creating comment' });
  }
});

// ------------------------------
// 2️⃣ Public – Get comments for an artist
// GET /comments/:artistId
// ------------------------------
router.get('/:artistId', async (req, res) => {
  try {
    const { artistId } = req.params;

    if (!validateObjectId(artistId)) {
      return res.status(400).json({ error: 'Invalid artistId' });
    }

    const comments = await Comment.find({ artistId, isDeleted: false })
      .sort({ createdAt: -1 })
      .lean();

    return res.json(comments);
  } catch (err) {
    console.error('Error fetching comments:', err);
    return res.status(500).json({ error: 'Server error fetching comments' });
  }
});

// ------------------------------
// 3️⃣ Public – Like a comment
// PATCH /comments/like/:commentId
// ------------------------------
router.patch('/like/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;

    if (!validateObjectId(commentId)) {
      return res.status(400).json({ error: 'Invalid commentId' });
    }

    const updated = await Comment.findByIdAndUpdate(
      commentId,
      { $inc: { likeCount: 1 } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    return res.json(updated);
  } catch (err) {
    console.error('Error liking comment:', err);
    return res.status(500).json({ error: 'Server error liking comment' });
  }
});

// ------------------------------
// 4️⃣ Public – Flag a comment
// PATCH /comments/flag/:commentId
// ------------------------------
router.patch('/flag/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { type = 'other', reason = null, reporterId = null } = req.body || {};

    if (!validateObjectId(commentId)) {
      return res.status(400).json({ error: 'Invalid commentId' });
    }

    const updated = await Comment.findByIdAndUpdate(
      commentId,
      {
        status: 'flagged',
        $push: {
          flags: {
            type,
            reason,
            reporterId,
            flaggedAt: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    return res.json(updated);
  } catch (err) {
    console.error('Error flagging comment:', err);
    return res.status(500).json({ error: 'Server error flagging comment' });
  }
});

// ------------------------------
// 5️⃣ Public – Soft delete own comment
// DELETE /comments/:commentId
// ------------------------------
router.delete('/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;

    if (!validateObjectId(commentId)) {
      return res.status(400).json({ error: 'Invalid commentId' });
    }

    const updated = await Comment.findByIdAndUpdate(
      commentId,
      {
        isDeleted: true,
        content: '[deleted]',
        deletedAt: new Date(),
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    return res.json(updated);
  } catch (err) {
    console.error('Error deleting comment:', err);
    return res.status(500).json({ error: 'Server error deleting comment' });
  }
});

// ==============================
// 🔐 ADMIN ROUTES (x-admin-key)
// ==============================

// 6️⃣ Admin – List all comments with filters + pagination
// GET /comments/admin?status=all|visible|flagged|deleted&page=1&limit=10&sort=newest|oldest|popular
router.get('/admin', adminAuth, async (req, res) => {
  try {
    const {
      status = 'all',
      page = 1,
      limit = 10,
      sort = 'newest',
      artistId = null,
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

    const filter = {};
    if (artistId) {
      filter.artistId = artistId;
    }
    if (status === 'visible') filter.isDeleted = false;
    if (status === 'deleted') filter.isDeleted = true;
    if (status === 'flagged') filter.status = 'flagged';

    const sortOption = {};
    if (sort === 'popular') {
      sortOption.likeCount = -1;
      sortOption.createdAt = -1;
    } else if (sort === 'oldest') {
      sortOption.createdAt = 1;
    } else {
      // newest
      sortOption.createdAt = -1;
    }

    const [total, data] = await Promise.all([
      Comment.countDocuments(filter),
      Comment.find(filter)
        .sort(sortOption)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
    ]);

    return res.json({
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.max(Math.ceil(total / limitNum), 1),
        sort,
        filters: {
          artistId: artistId || null,
          status,
        },
      },
      data,
    });
  } catch (err) {
    console.error('Error in admin comments list:', err);
    return res.status(500).json({ error: 'Server error fetching admin comments' });
  }
});

// 7️⃣ Admin – List comments by artist with same query params
// GET /comments/admin/by-artist/:artistId?status=&page=&limit=&sort=
router.get('/admin/by-artist/:artistId', adminAuth, async (req, res) => {
  try {
    const { artistId } = req.params;
    const {
      status = 'all',
      page = 1,
      limit = 10,
      sort = 'newest',
    } = req.query;

    if (!validateObjectId(artistId)) {
      return res.status(400).json({ error: 'Invalid artistId' });
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

    const filter = { artistId };
    if (status === 'visible') filter.isDeleted = false;
    if (status === 'deleted') filter.isDeleted = true;
    if (status === 'flagged') filter.status = 'flagged';

    const sortOption = {};
    if (sort === 'popular') {
      sortOption.likeCount = -1;
      sortOption.createdAt = -1;
    } else if (sort === 'oldest') {
      sortOption.createdAt = 1;
    } else {
      sortOption.createdAt = -1;
    }

    const [total, data] = await Promise.all([
      Comment.countDocuments(filter),
      Comment.find(filter)
        .sort(sortOption)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
    ]);

    return res.json({
      meta: {
        artistId,
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.max(Math.ceil(total / limitNum), 1),
        sort,
        filters: {
          artistId,
          status,
        },
      },
      data,
    });
  } catch (err) {
    console.error('Error in admin by-artist list:', err);
    return res.status(500).json({ error: 'Server error fetching admin artist comments' });
  }
});

// 8️⃣ Admin – Update moderation status / soft delete / restore
// PATCH /comments/admin/:commentId
router.patch('/admin/:commentId', adminAuth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const {
      status,
      isDeleted,
      markDeleted,
      restore,
      isPinned,
    } = req.body || {};

    if (!validateObjectId(commentId)) {
      return res.status(400).json({ error: 'Invalid commentId' });
    }

    const update = {};

    if (typeof status === 'string') update.status = status;
    if (typeof isPinned === 'boolean') update.isPinned = isPinned;

    if (markDeleted === true || isDeleted === true) {
      update.isDeleted = true;
      update.deletedAt = new Date();
      update.content = '[deleted]';
    }

    if (restore === true) {
      update.isDeleted = false;
      update.deletedAt = null;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updated = await Comment.findByIdAndUpdate(
      commentId,
      update,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    return res.json(updated);
  } catch (err) {
    console.error('Error in admin update:', err);
    return res.status(500).json({ error: 'Server error updating comment' });
  }
});

// 9️⃣ Admin – Hard delete a comment
// DELETE /comments/admin/:commentId
router.delete('/admin/:commentId', adminAuth, async (req, res) => {
  try {
    const { commentId } = req.params;

    if (!validateObjectId(commentId)) {
      return res.status(400).json({ error: 'Invalid commentId' });
    }

    const deleted = await Comment.findByIdAndDelete(commentId);

    if (!deleted) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    return res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (err) {
    console.error('Error in admin hard delete:', err);
    return res.status(500).json({ error: 'Server error deleting comment' });
  }
});

module.exports = router;