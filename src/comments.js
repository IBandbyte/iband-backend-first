// src/comments.js
// iBand – Comments Router (user + admin)
// Captain’s Protocol: full file, stable paths, Render-safe.

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Comment = require('../models/commentModel');

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function validateObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function getPaginationParams(req) {
  const pageRaw = parseInt(req.query.page, 10);
  const limitRaw = parseInt(req.query.limit, 10);

  const page = Number.isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;
  let limit = Number.isNaN(limitRaw) || limitRaw < 1 ? 10 : limitRaw;

  if (limit > 100) limit = 100;

  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function getSortOption(sortParam, defaultField = 'createdAt') {
  const sort = (sortParam || 'newest').toString().toLowerCase();

  switch (sort) {
    case 'oldest':
      return { [defaultField]: 1 };
    case 'popular':
      return { likeCount: -1, [defaultField]: -1 };
    default:
      // 'newest' or anything unknown
      return { [defaultField]: -1 };
  }
}

// --------------------------------------------------
// Admin auth helpers
// --------------------------------------------------

const ADMIN_COMMENTS_KEY = process.env.ADMIN_COMMENTS_KEY || 'mysecret123';

function requireAdmin(req, res, next) {
  const headerKey = req.header('x-admin-key');

  if (!headerKey || headerKey !== ADMIN_COMMENTS_KEY) {
    return res
      .status(401)
      .json({ error: 'Unauthorized: invalid admin key' });
  }

  return next();
}

// --------------------------------------------------
//  A. ADMIN ROUTES – defined BEFORE /:artistId
//  This fixes the bug where /admin was hitting /:artistId
// --------------------------------------------------

/**
 * GET /comments/admin
 *
 * Admin list of comments with filters + pagination.
 * Query params:
 *  - artistId (optional)
 *  - status: visible | flagged | deleted | all (default: all)
 *  - page, limit
 *  - sort: newest | oldest | popular
 */
router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const { artistId, status = 'all', sort } = req.query;
    const { page, limit, skip } = getPaginationParams(req);

    const filter = {};

    // Optional artist filter – only apply if non-empty
    if (artistId && artistId.trim() !== '') {
      const trimmed = artistId.trim();

      // Our artist IDs are Mongo ObjectIds, so we validate here
      if (!validateObjectId(trimmed)) {
        return res.status(400).json({ error: 'Invalid artistId' });
      }

      filter.artistId = trimmed;
    }

    // Status / deletion filters
    if (status && status !== 'all') {
      if (status === 'deleted') {
        filter.isDeleted = true;
      } else {
        filter.status = status;
        filter.isDeleted = false;
      }
    }

    const sortOption = getSortOption(sort);

    const total = await Comment.countDocuments(filter);
    const comments = await Comment.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPages = Math.max(Math.ceil(total / limit) || 1, 1);

    return res.json({
      meta: {
        page,
        limit,
        total,
        totalPages,
        sort: (sort || 'newest').toString().toLowerCase(),
        filters: {
          artistId: artistId && artistId.trim() !== '' ? artistId.trim() : null,
          status: status || 'all',
        },
      },
      data: comments,
    });
  } catch (err) {
    console.error('Error in admin comments list:', err);
    return res
      .status(500)
      .json({ error: 'Server error fetching admin comments' });
  }
});

/**
 * PATCH /comments/admin/status/:commentId
 *
 * Admin can change status (visible / flagged / hidden / deleted).
 * This is future-proof for the admin dashboard.
 */
router.patch('/admin/status/:commentId', requireAdmin, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { status } = req.body || {};

    if (!validateObjectId(commentId)) {
      return res.status(400).json({ error: 'Invalid commentId' });
    }

    const allowedStatuses = ['visible', 'flagged', 'hidden', 'deleted'];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Allowed: visible, flagged, hidden, deleted',
      });
    }

    const update = { status };

    if (status === 'deleted') {
      update.isDeleted = true;
      update.deletedAt = new Date();
      update.content = '[deleted]';
    }

    const updated = await Comment.findByIdAndUpdate(commentId, update, {
      new: true,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    return res.json(updated);
  } catch (err) {
    console.error('Error updating comment status (admin):', err);
    return res
      .status(500)
      .json({ error: 'Server error updating comment status' });
  }
});

/**
 * DELETE /comments/admin/hard/:commentId
 *
 * Hard delete – ONLY for admin tools.
 */
router.delete('/admin/hard/:commentId', requireAdmin, async (req, res) => {
  try {
    const { commentId } = req.params;

    if (!validateObjectId(commentId)) {
      return res.status(400).json({ error: 'Invalid commentId' });
    }

    const deleted = await Comment.findByIdAndDelete(commentId);

    if (!deleted) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Error hard-deleting comment (admin):', err);
    return res
      .status(500)
      .json({ error: 'Server error hard deleting comment' });
  }
});

// --------------------------------------------------
//  B. PUBLIC / ARTIST ROUTES
// --------------------------------------------------

/**
 * POST /comments/:artistId
 * Create a new comment for an artist.
 */
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
      await Comment.findByIdAndUpdate(parentId, {
        $inc: { replyCount: 1 },
      });
    }

    return res.status(201).json(comment);
  } catch (err) {
    console.error('Error creating comment:', err);
    return res.status(500).json({ error: 'Server error creating comment' });
  }
});

/**
 * GET /comments/:artistId
 * Public list of comments for a given artist, with pagination.
 */
router.get('/:artistId', async (req, res) => {
  try {
    const { artistId } = req.params;
    const { sort } = req.query;

    if (!validateObjectId(artistId)) {
      return res.status(400).json({ error: 'Invalid artistId' });
    }

    const { page, limit, skip } = getPaginationParams(req);
    const sortOption = getSortOption(sort);

    const filter = {
      artistId,
      isDeleted: false,
    };

    const total = await Comment.countDocuments(filter);
    const comments = await Comment.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPages = Math.max(Math.ceil(total / limit) || 1, 1);

    return res.json({
      meta: {
        artistId,
        page,
        limit,
        total,
        totalPages,
        sort: (sort || 'newest').toString().toLowerCase(),
      },
      data: comments,
    });
  } catch (err) {
    console.error('Error fetching comments:', err);
    return res.status(500).json({ error: 'Server error fetching comments' });
  }
});

/**
 * PATCH /comments/like/:commentId
 * Increment like count.
 */
router.patch('/like/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;

    if (!validateObjectId(commentId)) {
      return res.status(400).json({ error: 'Invalid commentId' });
    }

    const updated = await Comment.findOneAndUpdate(
      { _id: commentId, isDeleted: false },
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

/**
 * PATCH /comments/flag/:commentId
 * Flag a comment for moderation.
 */
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
      createdAt: new Date(),
    };

    const updated = await Comment.findByIdAndUpdate(
      commentId,
      {
        status: 'flagged',
        $push: { flags: flagEntry },
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

/**
 * DELETE /comments/:commentId
 * Soft delete a comment (user-level delete).
 */
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
        status: 'deleted',
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

module.exports = router;