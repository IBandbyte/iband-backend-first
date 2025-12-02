// src/comments.js
// iBand - Comments Router (mounted by server.js at /comments)
// Final production-ready router: public + admin moderation, pagination, sorting,
// robust validation, Hoppscotch/iPhone-compatible adminKey fallback for testing.

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Comment = require('../models/commentModel');

// ------------------------------
// Config / Admin auth
// ------------------------------
// Preferred env var: ADMIN_API_KEY
// Fallback (development safe): 'mysecret123'
// Optional test fallback: accept ?adminKey= in query when ALLOW_ADMIN_QUERY_KEY === 'true'
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'mysecret123';
const ALLOW_ADMIN_QUERY_KEY = process.env.ALLOW_ADMIN_QUERY_KEY === 'true';

function adminAuth(req, res, next) {
  const headerKey = req.header('x-admin-key');
  const queryKey = req.query && req.query.adminKey;
  const keyToCheck = headerKey || (ALLOW_ADMIN_QUERY_KEY ? queryKey : undefined);

  if (!keyToCheck || keyToCheck !== ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: invalid admin key' });
  }
  return next();
}

// ------------------------------
// Helpers
// ------------------------------
function validateObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id));
}

function parsePositiveInt(value, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n <= 0) return fallback;
  return n;
}

function buildSort(sortParam = 'newest') {
  const s = (String(sortParam || 'newest')).toLowerCase();
  switch (s) {
    case 'oldest':
      return { createdAt: 1 };
    case 'popular':
      return { likeCount: -1, createdAt: -1 };
    case 'newest':
    default:
      return { createdAt: -1 };
  }
}

// Standardized admin list response meta
function adminMeta(page, limit, total, sort, artistId, status) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    sort,
    filters: {
      artistId: artistId || null,
      status: status || 'all'
    }
  };
}

// ------------------------------
// IMPORTANT: Define ADMIN routes BEFORE artist/:id route
// to avoid Express matching 'admin' as an :artistId param.
// ------------------------------

// ---------------------------------------------------------------------
// Admin: GET /comments/admin
// Query:
//   status = all | visible | flagged | deleted
//   artistId (optional) - treated as string; validated only if non-empty
//   page, limit, sort
// Headers:
//   x-admin-key: <ADMIN_API_KEY>  (or ?adminKey= if allowed)
// ---------------------------------------------------------------------
router.get('/admin', adminAuth, async (req, res) => {
  try {
    const status = (req.query.status || 'all').toLowerCase();
    const artistId = req.query.artistId ? String(req.query.artistId).trim() : null;
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const sortParam = req.query.sort || 'newest';
    const sort = buildSort(sortParam);

    const filter = {};

    // Only validate artistId if provided and non-empty
    if (artistId) {
      // We accept string-based artistId because your model stores artistId as string/ObjectId.
      // If it looks like an ObjectId, validate it; otherwise just match string.
      if (validateObjectId(artistId) === false && artistId.length === 24) {
        return res.status(400).json({ error: 'Invalid artistId' });
      }
      filter.artistId = artistId;
    }

    // Status filters
    if (status && status !== 'all') {
      if (status === 'deleted') {
        filter.isDeleted = true;
      } else if (status === 'visible') {
        filter.status = 'visible';
        filter.isDeleted = { $ne: true };
      } else if (status === 'flagged') {
        filter.status = 'flagged';
      } else {
        // unknown status - return 400
        return res.status(400).json({ error: 'Invalid status filter' });
      }
    }

    const total = await Comment.countDocuments(filter);
    const data = await Comment.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.json({
      meta: adminMeta(page, limit, total, sortParam, artistId, status),
      data
    });
  } catch (err) {
    console.error('Error in admin list:', err);
    return res.status(500).json({ error: 'Server error fetching admin comments' });
  }
});

// ---------------------------------------------------------------------
// Admin: GET /comments/admin/by-artist/:artistId
// (strict artistId validation here)
// ---------------------------------------------------------------------
router.get('/admin/by-artist/:artistId', adminAuth, async (req, res) => {
  try {
    const { artistId } = req.params;
    const status = (req.query.status || 'all').toLowerCase();
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const sortParam = req.query.sort || 'newest';
    const sort = buildSort(sortParam);

    if (!artistId || !validateObjectId(artistId)) {
      return res.status(400).json({ error: 'Invalid artistId' });
    }

    const filter = { artistId };

    if (status && status !== 'all') {
      if (status === 'deleted') filter.isDeleted = true;
      else if (status === 'visible') {
        filter.status = 'visible';
        filter.isDeleted = { $ne: true };
      } else if (status === 'flagged') filter.status = 'flagged';
      else return res.status(400).json({ error: 'Invalid status filter' });
    }

    const total = await Comment.countDocuments(filter);
    const data = await Comment.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.json({
      meta: adminMeta(page, limit, total, sortParam, artistId, status),
      data
    });
  } catch (err) {
    console.error('Error in admin by-artist:', err);
    return res.status(500).json({ error: 'Server error fetching admin artist comments' });
  }
});

// ---------------------------------------------------------------------
// Admin: PATCH /comments/admin/:commentId
// Body: { status?, isDeleted?, isPinned?, markDeleted?, restore? }
// ---------------------------------------------------------------------
router.patch('/admin/:commentId', adminAuth, async (req, res) => {
  try {
    const { commentId } = req.params;
    if (!validateObjectId(commentId)) {
      return res.status(400).json({ error: 'Invalid commentId' });
    }

    const {
      status,
      isDeleted,
      isPinned,
      markDeleted,
      restore
    } = req.body || {};

    const update = {};

    if (typeof status === 'string') update.status = status;
    if (typeof isPinned === 'boolean') update.isPinned = isPinned;

    // Soft delete via flags
    if (markDeleted === true || isDeleted === true) {
      update.isDeleted = true;
      update.deletedAt = new Date();
      update.content = '[deleted]';
      update.status = 'deleted';
    }

    if (restore === true) {
      update.isDeleted = false;
      update.deletedAt = null;
      update.status = 'visible';
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updated = await Comment.findByIdAndUpdate(commentId, update, { new: true });
    if (!updated) return res.status(404).json({ error: 'Comment not found' });

    return res.json(updated);
  } catch (err) {
    console.error('Error in admin update:', err);
    return res.status(500).json({ error: 'Server error updating comment' });
  }
});

// ---------------------------------------------------------------------
// Admin: DELETE /comments/admin/:commentId  (hard delete)
// ---------------------------------------------------------------------
router.delete('/admin/:commentId', adminAuth, async (req, res) => {
  try {
    const { commentId } = req.params;
    if (!validateObjectId(commentId)) {
      return res.status(400).json({ error: 'Invalid commentId' });
    }

    const deleted = await Comment.findByIdAndDelete(commentId);
    if (!deleted) return res.status(404).json({ error: 'Comment not found' });

    return res.json({ success: true, message: 'Comment deleted successfully', id: commentId });
  } catch (err) {
    console.error('Error in admin hard delete:', err);
    return res.status(500).json({ error: 'Server error deleting comment' });
  }
});

// ---------------------------------------------------------------------
// Admin: POST /comments/admin/bulk
// Body: { action: 'approve'|'reject'|'restore'|'delete'|'hard-delete', ids: [] }
// ---------------------------------------------------------------------
router.post('/admin/bulk', adminAuth, async (req, res) => {
  try {
    const { action, ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' });
    }

    const validIds = ids.filter((id) => validateObjectId(id));
    if (validIds.length === 0) {
      return res.status(400).json({ error: 'No valid comment IDs provided' });
    }

    let result;
    switch (action) {
      case 'approve':
      case 'restore':
        result = await Comment.updateMany({ _id: { $in: validIds } }, { $set: { status: 'visible', isDeleted: false, deletedAt: null } });
        break;
      case 'reject':
        result = await Comment.updateMany({ _id: { $in: validIds } }, { $set: { status: 'rejected' } });
        break;
      case 'delete':
        result = await Comment.updateMany({ _id: { $in: validIds } }, { $set: { status: 'deleted', isDeleted: true, deletedAt: new Date(), content: '[deleted]' } });
        break;
      case 'hard-delete':
        result = await Comment.deleteMany({ _id: { $in: validIds } });
        break;
      default:
        return res.status(400).json({ error: 'Invalid action for bulk moderation' });
    }

    return res.json({
      success: true,
      action,
      matched: result.matchedCount ?? result.n ?? undefined,
      modified: result.modifiedCount ?? result.nModified ?? undefined,
      deleted: result.deletedCount ?? undefined
    });
  } catch (err) {
    console.error('Error in admin bulk:', err);
    return res.status(500).json({ error: 'Server error in bulk moderation' });
  }
});

// ------------------------------
// PUBLIC / ARTIST routes (after admin routes)
// ------------------------------

// ---------------------------------------------------------------------
// 1) POST /comments/:artistId  (create comment for artist)
// ---------------------------------------------------------------------
router.post('/:artistId', async (req, res, next) => {
  try {
    const { artistId } = req.params;

    // Avoid conflict if someone requests /comments/admin via artistId
    if (artistId === 'admin') return next();

    const {
      content,
      parentId = null,
      userId = null,
      userDisplayName = 'Anonymous',
      userAvatarUrl = null,
      ipAddress = null,
      userAgent = null,
      deviceId = null
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
      status: 'visible',
      isDeleted: false
    });

    await comment.save();

    if (parentId && validateObjectId(parentId)) {
      await Comment.findByIdAndUpdate(parentId, { $inc: { replyCount: 1 } });
    }

    return res.status(201).json(comment);
  } catch (err) {
    console.error('Error creating comment:', err);
    return res.status(500).json({ error: 'Server error creating comment' });
  }
});

// ---------------------------------------------------------------------
// 2) GET /comments/:artistId  (public list with pagination)
// Query: ?page=&limit=&sort= (newest|oldest|popular)
// ---------------------------------------------------------------------
router.get('/:artistId', async (req, res, next) => {
  try {
    const { artistId } = req.params;

    // If someone requested /comments/admin (rare), pass to admin route
    if (artistId === 'admin') return next();

    const { page = 1, limit = 10, sort = 'newest' } = req.query;

    if (!validateObjectId(artistId)) {
      return res.status(400).json({ error: 'Invalid artistId' });
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const sortOption = buildSort(sort);

    const filter = { artistId, isDeleted: { $ne: true } };

    const [data, total] = await Promise.all([
      Comment.find(filter).sort(sortOption).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
      Comment.countDocuments(filter)
    ]);

    return res.json({
      meta: {
        artistId,
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
        sort
      },
      data
    });
  } catch (err) {
    console.error('Error fetching artist comments:', err);
    return res.status(500).json({ error: 'Server error fetching comments' });
  }
});

// ---------------------------------------------------------------------
// 3) PATCH /comments/like/:commentId
// ---------------------------------------------------------------------
router.patch('/like/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    if (!validateObjectId(commentId)) {
      return res.status(400).json({ error: 'Invalid commentId' });
    }

    const updated = await Comment.findOneAndUpdate(
      { _id: commentId, isDeleted: { $ne: true } },
      { $inc: { likeCount: 1 } },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Comment not found' });

    return res.json(updated);
  } catch (err) {
    console.error('Error liking comment:', err);
    return res.status(500).json({ error: 'Server error liking comment' });
  }
});

// ---------------------------------------------------------------------
// 4) PATCH /comments/flag/:commentId
// ---------------------------------------------------------------------
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
      createdAt: new Date()
    };

    const updated = await Comment.findByIdAndUpdate(
      commentId,
      { status: 'flagged', $push: { flags: flagEntry } },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Comment not found' });

    return res.json(updated);
  } catch (err) {
    console.error('Error flagging comment:', err);
    return res.status(500).json({ error: 'Server error flagging comment' });
  }
});

// ---------------------------------------------------------------------
// 5) DELETE /comments/:commentId  (soft delete public)
// ---------------------------------------------------------------------
router.delete('/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;

    // avoid collision with /admin
    if (commentId === 'admin') return res.status(400).json({ error: 'Bad request' });

    if (!validateObjectId(commentId)) {
      return res.status(400).json({ error: 'Invalid commentId' });
    }

    const updated = await Comment.findByIdAndUpdate(
      commentId,
      { isDeleted: true, status: 'deleted', content: '[deleted]', deletedAt: new Date() },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Comment not found' });

    return res.json(updated);
  } catch (err) {
    console.error('Error deleting comment:', err);
    return res.status(500).json({ error: 'Server error deleting comment' });
  }
});

module.exports = router;