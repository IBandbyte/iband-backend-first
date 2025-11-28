// server/comments.js
// Comment routes (public + admin)

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// ⚠️ IMPORTANT: keep this path exactly how it already exists in your project.
// If your Comment model file is named differently, use that same path here.
const Comment = require('./models/commentModel'); // this should match your existing model path

// Simple admin middleware using header x-admin-key
const ADMIN_KEY = process.env.ADMIN_KEY || 'mysecret123';

function adminAuth(req, res, next) {
  const headerKey = req.headers['x-admin-key'];
  if (!headerKey || headerKey !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized: invalid admin key' });
  }
  next();
}

/**
 * Helper: build sort object from sort string
 */
function getSortOption(sort) {
  switch (sort) {
    case 'oldest':
      return { createdAt: 1 };
    case 'popular':
      return { likeCount: -1, createdAt: -1 };
    case 'newest':
    default:
      return { createdAt: -1 };
  }
}

/**
 * PUBLIC: create a comment
 * POST /comments
 */
router.post('/', async (req, res) => {
  try {
    const {
      artistId,
      content,
      parentId = null,
      userId = null,
      userDisplayName = 'Anonymous',
      userAvatarUrl = null,
      ipAddress = null,
      userAgent = null,
      deviceId = null,
    } = req.body;

    if (!artistId || !mongoose.Types.ObjectId.isValid(artistId)) {
      return res.status(400).json({ error: 'Invalid or missing artistId' });
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const comment = await Comment.create({
      artistId,
      content: content.trim(),
      parentId,
      userId,
      userDisplayName,
      userAvatarUrl,
      ipAddress,
      userAgent,
      deviceId,
      likeCount: 0,
      replyCount: 0,
      status: 'visible',
      isDeleted: false,
      deletedAt: null,
      flags: [],
    });

    return res.status(201).json(comment);
  } catch (err) {
    console.error('Error creating comment:', err);
    return res.status(500).json({ error: 'Failed to create comment' });
  }
});

/**
 * PUBLIC: get comments for an artist with pagination + sorting
 * GET /comments/:artistId?page=&limit=&sort=
 */
router.get('/:artistId', async (req, res) => {
  try {
    const { artistId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(artistId)) {
      return res.status(400).json({ error: 'Invalid artistId' });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const sort = req.query.sort || 'newest'; // newest | oldest | popular

    const filter = {
      artistId,
      isDeleted: false,
      status: 'visible',
    };

    const sortOption = getSortOption(sort);

    const [items, total] = await Promise.all([
      Comment.find(filter)
        .sort(sortOption)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Comment.countDocuments(filter),
    ]);

    return res.json({
      meta: {
        artistId,
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        sort,
      },
      data: items,
    });
  } catch (err) {
    console.error('Error fetching artist comments:', err);
    return res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

/**
 * PUBLIC: like a comment
 * PATCH /comments/like/:commentId
 */
router.patch('/like/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ error: 'Invalid commentId' });
    }

    const comment = await Comment.findByIdAndUpdate(
      commentId,
      { $inc: { likeCount: 1 } },
      { new: true }
    );

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    return res.json(comment);
  } catch (err) {
    console.error('Error liking comment:', err);
    return res.status(500).json({ error: 'Failed to like comment' });
  }
});

/**
 * PUBLIC: flag a comment
 * PATCH /comments/flag/:commentId
 */
router.patch('/flag/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ error: 'Invalid commentId' });
    }

    const { type = 'other', reason = null, reporterId = null } = req.body || {};

    const flag = {
      type,
      reason,
      reporterId,
      flaggedAt: new Date(),
    };

    const comment = await Comment.findByIdAndUpdate(
      commentId,
      {
        $set: { status: 'flagged' },
        $push: { flags: flag },
      },
      { new: true }
    );

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    return res.json(comment);
  } catch (err) {
    console.error('Error flagging comment:', err);
    return res.status(500).json({ error: 'Failed to flag comment' });
  }
});

/**
 * PUBLIC: soft delete a comment
 * DELETE /comments/:commentId
 */
router.delete('/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ error: 'Invalid commentId' });
    }

    const comment = await Comment.findByIdAndUpdate(
      commentId,
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          content: '[deleted]',
        },
      },
      { new: true }
    );

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    return res.json(comment);
  } catch (err) {
    console.error('Error soft deleting comment:', err);
    return res.status(500).json({ error: 'Failed to delete comment' });
  }
});

/* ------------------------------------------------------------------
 * ADMIN ROUTES
 * -----------------------------------------------------------------*/

/**
 * ADMIN: list comments with optional artist filter
 * GET /comments/admin?status=&artistId=&page=&limit=&sort=
 *
 * - status: all | visible | flagged | deleted
 * - artistId: optional ObjectId (if omitted, no filter)
 * - sort: newest | oldest | popular
 */
router.get('/admin', adminAuth, async (req, res) => {
  try {
    const {
      artistId,              // optional
      status = 'all',
      page = 1,
      limit = 10,
      sort = 'newest',
    } = req.query;

    const numericPage = parseInt(page, 10) || 1;
    const numericLimit = Math.min(parseInt(limit, 10) || 10, 50);

    const filter = {};

    // ✅ IMPORTANT: ONLY validate artistId if it is actually provided
    if (artistId) {
      if (!mongoose.Types.ObjectId.isValid(artistId)) {
        return res.status(400).json({ error: 'Invalid artistId' });
      }
      filter.artistId = artistId;
    }

    if (status && status !== 'all') {
      if (status === 'visible') {
        filter.status = 'visible';
        filter.isDeleted = false;
      } else if (status === 'flagged') {
        filter.status = 'flagged';
      } else if (status === 'deleted') {
        filter.isDeleted = true;
      }
    }

    const sortOption = getSortOption(sort);

    const [items, total] = await Promise.all([
      Comment.find(filter)
        .sort(sortOption)
        .skip((numericPage - 1) * numericLimit)
        .limit(numericLimit)
        .lean(),
      Comment.countDocuments(filter),
    ]);

    return res.json({
      meta: {
        page: numericPage,
        limit: numericLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / numericLimit)),
        sort,
        filters: {
          artistId: artistId || null,
          status,
        },
      },
      data: items,
    });
  } catch (err) {
    console.error('Error fetching admin comments:', err);
    return res.status(500).json({ error: 'Failed to fetch admin comments' });
  }
});

/**
 * ADMIN: update / moderate a comment
 * PATCH /comments/admin/:commentId
 * Body can contain: { status, isDeleted }
 */
router.patch('/admin/:commentId', adminAuth, async (req, res) => {
  try {
    const { commentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ error: 'Invalid commentId' });
    }

    const updates = {};
    const { status, isDeleted } = req.body || {};

    if (typeof status === 'string') {
      updates.status = status;
    }

    if (typeof isDeleted === 'boolean') {
      updates.isDeleted = isDeleted;
      updates.deletedAt = isDeleted ? new Date() : null;
      if (isDeleted) {
        updates.content = '[deleted]';
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const comment = await Comment.findByIdAndUpdate(
      commentId,
      { $set: updates },
      { new: true }
    );

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    return res.json(comment);
  } catch (err) {
    console.error('Error updating comment (admin):', err);
    return res.status(500).json({ error: 'Failed to update comment' });
  }
});

/**
 * ADMIN: hard delete a comment
 * DELETE /comments/admin/:commentId
 */
router.delete('/admin/:commentId', adminAuth, async (req, res) => {
  try {
    const { commentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ error: 'Invalid commentId' });
    }

    const deleted = await Comment.findByIdAndDelete(commentId);

    if (!deleted) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    return res.json({
      success: true,
      message: 'Comment deleted permanently',
      id: commentId,
    });
  } catch (err) {
    console.error('Error hard deleting comment (admin):', err);
    return res.status(500).json({ error: 'Failed to delete comment' });
  }
});

module.exports = router;