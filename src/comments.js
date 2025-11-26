// src/comments.js
// iBand - Comments Router (mounted by server.js at /comments)
// Captain’s Protocol: full file, stable paths, Render-safe.

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Uses root/models folder
const Comment = require('../models/commentModel');

// Small helper to validate Mongo IDs (for commentId, artistId path params)
function validateObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// ---------------------------------------------------------
// 1️⃣ Create a new comment for an artist
// POST /comments/:artistId
// ---------------------------------------------------------
router.post('/:artistId', async (req, res) => {
  try {
    const { artistId } = req.params;

    // For safety, make sure this at least looks like a Mongo ObjectId.
    // It is stored as a string in the Comment model.
    if (!validateObjectId(artistId)) {
      return res.status(400).json({ error: 'Invalid artistId' });
    }

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

// ---------------------------------------------------------
// 2️⃣ Public: Get comments for an artist (simple list)
// GET /comments/:artistId
// Optional query: ?page=&limit=&sort= (same as artist scoped pagination)
// ---------------------------------------------------------
router.get('/:artistId', async (req, res, next) => {
  try {
    const { artistId } = req.params;
    const { page, limit, sort } = req.query || {};

    // If the path segment is actually "admin", let the admin route handle it
    if (artistId === 'admin') {
      return next();
    }

    if (!validateObjectId(artistId)) {
      return res.status(400).json({ error: 'Invalid artistId' });
    }

    // If no pagination params, return simple array (backwards compatible)
    if (!page && !limit && !sort) {
      const comments = await Comment.find({
        artistId,
        isDeleted: { $ne: true },
      })
        .sort({ createdAt: -1 })
        .lean();

      return res.json(comments);
    }

    // Otherwise use the same logic as the artist-scoped pagination
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);

    let sortOption = { createdAt: -1 }; // default newest
    if (sort === 'oldest') sortOption = { createdAt: 1 };
    if (sort === 'popular') sortOption = { likeCount: -1, createdAt: -1 };

    const query = {
      artistId,
      isDeleted: { $ne: true },
    };

    const [data, total] = await Promise.all([
      Comment.find(query).sort(sortOption).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
      Comment.countDocuments(query),
    ]);

    return res.json({
      meta: {
        artistId,
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.max(Math.ceil(total / limitNum), 1),
        sort: sort || 'newest',
      },
      data,
    });
  } catch (err) {
    console.error('Error fetching artist comments:', err);
    return res.status(500).json({ error: 'Server error fetching comments' });
  }
});

// ---------------------------------------------------------
// 3️⃣ Like a comment
// PATCH /comments/like/:commentId
// ---------------------------------------------------------
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

// ---------------------------------------------------------
// 4️⃣ Flag a comment
// PATCH /comments/flag/:commentId
// ---------------------------------------------------------
router.patch('/flag/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { type = 'other', reason = null, reporterId = null } = req.body || {};

    if (!validateObjectId(commentId)) {
      return res.status(400).json({ error: 'Invalid commentId' });
    }

    const flagEntry = {
      type,
      reason,
      reporterId,
      flaggedAt: new Date(),
    };

    const updated = await Comment.findByIdAndUpdate(
      commentId,
      {
        status: 'flagged',
        $push: {
          flags: flagEntry,
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

// ---------------------------------------------------------
// 5️⃣ Soft delete a comment
// DELETE /comments/:commentId
// ---------------------------------------------------------
router.delete('/:commentId', async (req, res, next) => {
  try {
    const { commentId } = req.params;

    // If this is actually the "admin" path, let the admin router handle it
    if (commentId === 'admin') {
      return next();
    }

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

// ---------------------------------------------------------
// 6️⃣ Admin view: paginated comments (global & per-artist)
// GET /comments/admin
// Query:
//   artistId (optional)
//   status = all | visible | flagged | deleted
//   page, limit
//   sort = newest | oldest | popular
// Requires x-admin-key header checked in server.js middleware
// ---------------------------------------------------------
router.get('/admin', async (req, res) => {
  try {
    const {
      artistId,
      status = 'all',
      page = 1,
      limit = 10,
      sort = 'newest',
    } = req.query || {};

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);

    const query = {};

    // 🔹 IMPORTANT: for admin filtering we DO NOT validate as ObjectId.
    // We just match the stored string exactly. This fixes the “total: 0” bug.
    if (artistId) {
      query.artistId = String(artistId);
    }

    // Status & deletion filters
    if (status === 'visible') {
      query.status = 'visible';
      query.isDeleted = { $ne: true };
    } else if (status === 'flagged') {
      query.status = 'flagged';
    } else if (status === 'deleted') {
      query.isDeleted = true;
    } else {
      // "all" -> no extra status filter, show everything
    }

    let sortOption = { createdAt: -1 }; // default newest
    if (sort === 'oldest') sortOption = { createdAt: 1 };
    if (sort === 'popular') sortOption = { likeCount: -1, createdAt: -1 };

    const [data, total] = await Promise.all([
      Comment.find(query)
        .sort(sortOption)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Comment.countDocuments(query),
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

module.exports = router;