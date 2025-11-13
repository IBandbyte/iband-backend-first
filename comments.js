// backend/src/routes/comments.js
// iBand - Comment & Thread Routes (future-proof, Hoppscotch-friendly)

const express = require('express');
const router = express.Router();

// Assumes you have a Comment model set up, e.g. with Mongoose:
// const Comment = require('../models/commentModel');
const Comment = require('../models/commentModel');

// Utility: build a standard JSON response
const successResponse = (data, meta = {}) => ({
  success: true,
  data,
  meta,
});

const errorResponse = (message, code = 'BAD_REQUEST', details = null) => ({
  success: false,
  error: {
    code,
    message,
    details,
  },
});

// Helper: basic pagination parsing
const parsePagination = (req) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(
    Math.max(parseInt(req.query.limit || '20', 10), 1),
    100
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

// Helper: basic sort parsing
const parseSort = (req, defaultSort = '-createdAt') => {
  const sort = req.query.sort || defaultSort;
  // Security: allow only a whitelisted set of fields
  const allowedSortFields = ['createdAt', 'likeCount', 'replyCount'];
  let field = sort;
  let direction = 1;

  if (sort.startsWith('-')) {
    field = sort.substring(1);
    direction = -1;
  }

  if (!allowedSortFields.includes(field)) {
    // fallback to default
    field = defaultSort.replace('-', '');
    direction = defaultSort.startsWith('-') ? -1 : 1;
  }

  return { [field]: direction };
};

// =========================================
// ROUTES
// Base path: /api/comments
// =========================================

/**
 * POST /api/comments
 * Create a new comment (top-level or reply, depending on parentId)
 *
 * Body:
 * - artistId (required)
 * - content (required)
 * - parentId (optional, for replies)
 * - userId (optional, if logged in)
 * - userDisplayName (optional)
 * - userAvatarUrl (optional)
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
    } = req.body || {};

    if (!artistId) {
      return res.status(400).json(
        errorResponse('artistId is required.', 'VALIDATION_ERROR', {
          field: 'artistId',
        })
      );
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json(
        errorResponse('content is required.', 'VALIDATION_ERROR', {
          field: 'content',
        })
      );
    }

    const trimmedContent = content.trim();

    // Optional: content length limit
    if (trimmedContent.length > 2000) {
      return res.status(400).json(
        errorResponse(
          'content is too long (max 2000 characters).',
          'VALIDATION_ERROR',
          { field: 'content', maxLength: 2000 }
        )
      );
    }

    const commentData = {
      artistId,
      content: trimmedContent,
      parentId,
      userId,
      userDisplayName,
      userAvatarUrl,
      // Future-proof fields (depending on your schema):
      likeCount: 0,
      replyCount: 0,
      isPinned: false,
      isDeleted: false,
      status: 'visible', // visible | hidden | flagged | blocked
      flags: [],
    };

    const created = await Comment.create(commentData);

    // If this is a reply, increment replyCount on parent if parent exists
    if (parentId) {
      try {
        await Comment.findByIdAndUpdate(parentId, {
          $inc: { replyCount: 1 },
        });
      } catch (err) {
        // Non-fatal error: log but don't break the response
        console.error('Failed to increment parent replyCount:', err.message);
      }
    }

    return res.status(201).json(successResponse(created));
  } catch (err) {
    console.error('Error creating comment:', err);
    return res
      .status(500)
      .json(errorResponse('Failed to create comment.', 'SERVER_ERROR'));
  }
});

/**
 * GET /api/comments
 * List comments with filters + pagination
 *
 * Query params:
 * - artistId (optional but usually provided)
 * - parentId (optional; if not provided, defaults to only top-level comments)
 * - userId (optional)
 * - status (optional; e.g. "visible")
 * - sort (optional: "-createdAt", "createdAt", "-likeCount", etc.)
 * - page (optional, default: 1)
 * - limit (optional, default: 20, max: 100)
 * - includeDeleted (optional: "true" to include deleted comments)
 */
router.get('/', async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const sort = parseSort(req);

    const {
      artistId,
      parentId,
      userId,
      status,
      includeDeleted = 'false',
    } = req.query;

    const includeDeletedBool = includeDeleted === 'true';

    const filter = {};

    if (artistId) filter.artistId = artistId;
    if (userId) filter.userId = userId;
    if (status) filter.status = status;

    // Only top-level comments by default
    if (typeof parentId !== 'undefined') {
      filter.parentId = parentId;
    } else {
      filter.parentId = null;
    }

    if (!includeDeletedBool) {
      filter.isDeleted = { $ne: true };
    }

    const [items, total] = await Promise.all([
      Comment.find(filter).sort(sort).skip(skip).limit(limit),
      Comment.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return res.json(
      successResponse(items, {
        page,
        limit,
        total,
        totalPages,
      })
    );
  } catch (err) {
    console.error('Error listing comments:', err);
    return res
      .status(500)
      .json(errorResponse('Failed to fetch comments.', 'SERVER_ERROR'));
  }
});

/**
 * GET /api/comments/:id
 * Get a single comment by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const comment = await Comment.findById(id);

    if (!comment) {
      return res
        .status(404)
        .json(errorResponse('Comment not found.', 'NOT_FOUND'));
    }

    return res.json(successResponse(comment));
  } catch (err) {
    console.error('Error fetching comment:', err);
    return res
      .status(500)
      .json(errorResponse('Failed to fetch comment.', 'SERVER_ERROR'));
  }
});

/**
 * PATCH /api/comments/:id
 * Update a comment (partial update)
 *
 * Body fields (all optional, but at least one should be provided):
 * - content
 * - isPinned
 * - status
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const allowedFields = ['content', 'isPinned', 'status'];
    const update = {};

    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        update[key] = req.body[key];
      }
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json(
        errorResponse(
          'No valid fields provided for update.',
          'VALIDATION_ERROR'
        )
      );
    }

    if (update.content) {
      const trimmed = String(update.content).trim();
      if (!trimmed) {
        return res.status(400).json(
          errorResponse('content cannot be empty.', 'VALIDATION_ERROR', {
            field: 'content',
          })
        );
      }
      if (trimmed.length > 2000) {
        return res.status(400).json(
          errorResponse(
            'content is too long (max 2000 characters).',
            'VALIDATION_ERROR',
            { field: 'content', maxLength: 2000 }
          )
        );
      }
      update.content = trimmed;
    }

    const updated = await Comment.findByIdAndUpdate(id, update, {
      new: true,
    });

    if (!updated) {
      return res
        .status(404)
        .json(errorResponse('Comment not found.', 'NOT_FOUND'));
    }

    return res.json(successResponse(updated));
  } catch (err) {
    console.error('Error updating comment:', err);
    return res
      .status(500)
      .json(errorResponse('Failed to update comment.', 'SERVER_ERROR'));
  }
});

/**
 * DELETE /api/comments/:id
 * Soft delete by default, with optional hard delete
 *
 * Query:
 * - hard=true (optional, will permanently remove the comment)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const hard = req.query.hard === 'true';

    if (hard) {
      const deleted = await Comment.findByIdAndDelete(id);
      if (!deleted) {
        return res
          .status(404)
          .json(errorResponse('Comment not found.', 'NOT_FOUND'));
      }

      // If this was a reply, decrement parent replyCount
      if (deleted.parentId) {
        try {
          await Comment.findByIdAndUpdate(deleted.parentId, {
            $inc: { replyCount: -1 },
          });
        } catch (err) {
          console.error(
            'Failed to decrement parent replyCount on hard delete:',
            err.message
          );
        }
      }

      return res.json(
        successResponse({
          message: 'Comment permanently deleted.',
          id: deleted._id,
        })
      );
    }

    // Soft delete
    const updated = await Comment.findByIdAndUpdate(
      id,
      {
        isDeleted: true,
        status: 'hidden',
        deletedAt: new Date(),
      },
      { new: true }
    );

    if (!updated) {
      return res
        .status(404)
        .json(errorResponse('Comment not found.', 'NOT_FOUND'));
    }

    // If this was a reply, decrement parent replyCount
    if (updated.parentId) {
      try {
        await Comment.findByIdAndUpdate(updated.parentId, {
          $inc: { replyCount: -1 },
        });
      } catch (err) {
        console.error(
          'Failed to decrement parent replyCount on soft delete:',
          err.message
        );
      }
    }

    return res.json(
      successResponse({
        message: 'Comment soft-deleted.',
        id: updated._id,
      })
    );
  } catch (err) {
    console.error('Error deleting comment:', err);
    return res
      .status(500)
      .json(errorResponse('Failed to delete comment.', 'SERVER_ERROR'));
  }
});

/**
 * POST /api/comments/:id/replies
 * Create a reply to a given comment
 *
 * Body:
 * - content (required)
 * - userId (optional)
 * - userDisplayName (optional)
 * - userAvatarUrl (optional)
 *
 * NOTE: artistId is inferred from parent comment
 */
router.post('/:id/replies', async (req, res) => {
  try {
    const { id: parentId } = req.params;

    const parent = await Comment.findById(parentId);

    if (!parent) {
      return res
        .status(404)
        .json(errorResponse('Parent comment not found.', 'NOT_FOUND'));
    }

    if (!req.body || !req.body.content) {
      return res.status(400).json(
        errorResponse('content is required.', 'VALIDATION_ERROR', {
          field: 'content',
        })
      );
    }

    const {
      content,
      userId = null,
      userDisplayName = 'Anonymous',
      userAvatarUrl = null,
    } = req.body;

    const trimmedContent = String(content).trim();

    if (!trimmedContent) {
      return res.status(400).json(
        errorResponse('content cannot be empty.', 'VALIDATION_ERROR', {
          field: 'content',
        })
      );
    }

    if (trimmedContent.length > 2000) {
      return res.status(400).json(
        errorResponse(
          'content is too long (max 2000 characters).',
          'VALIDATION_ERROR',
          { field: 'content', maxLength: 2000 }
        )
      );
    }

    const replyData = {
      artistId: parent.artistId,
      content: trimmedContent,
      parentId,
      userId,
      userDisplayName,
      userAvatarUrl,
      likeCount: 0,
      replyCount: 0,
      isPinned: false,
      isDeleted: false,
      status: 'visible',
      flags: [],
    };

    const reply = await Comment.create(replyData);

    // Increment replyCount on parent
    try {
      await Comment.findByIdAndUpdate(parentId, {
        $inc: { replyCount: 1 },
      });
    } catch (err) {
      console.error('Failed to increment parent replyCount:', err.message);
    }

    return res.status(201).json(successResponse(reply));
  } catch (err) {
    console.error('Error creating reply:', err);
    return res
      .status(500)
      .json(errorResponse('Failed to create reply.', 'SERVER_ERROR'));
  }
});

/**
 * GET /api/comments/:id/replies
 * Get replies for a specific comment
 *
 * Query params:
 * - sort, page, limit (same as main list)
 * - includeDeleted (optional: "true")
 */
router.get('/:id/replies', async (req, res) => {
  try {
    const { id: parentId } = req.params;
    const { page, limit, skip } = parsePagination(req);
    const sort = parseSort(req);
    const { includeDeleted = 'false' } = req.query;

    const includeDeletedBool = includeDeleted === 'true';

    const filter = { parentId };

    if (!includeDeletedBool) {
      filter.isDeleted = { $ne: true };
    }

    const [items, total] = await Promise.all([
      Comment.find(filter).sort(sort).skip(skip).limit(limit),
      Comment.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return res.json(
      successResponse(items, {
        page,
        limit,
        total,
        totalPages,
      })
    );
  } catch (err) {
    console.error('Error fetching replies:', err);
    return res
      .status(500)
      .json(errorResponse('Failed to fetch replies.', 'SERVER_ERROR'));
  }
});

/**
 * POST /api/comments/:id/like
 * Increment like count on a comment
 *
 * (Future: you can connect this with userId/IP/device to prevent multiple likes)
 */
router.post('/:id/like', async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await Comment.findByIdAndUpdate(
      id,
      { $inc: { likeCount: 1 } },
      { new: true }
    );

    if (!updated) {
      return res
        .status(404)
        .json(errorResponse('Comment not found.', 'NOT_FOUND'));
    }

    return res.json(
      successResponse({
        id: updated._id,
        likeCount: updated.likeCount,
      })
    );
  } catch (err) {
    console.error('Error liking comment:', err);
    return res
      .status(500)
      .json(errorResponse('Failed to like comment.', 'SERVER_ERROR'));
  }
});

/**
 * POST /api/comments/:id/unlike
 * Decrement like count on a comment (not going below 0)
 */
router.post('/:id/unlike', async (req, res) => {
  try {
    const { id } = req.params;

    const comment = await Comment.findById(id);
    if (!comment) {
      return res
        .status(404)
        .json(errorResponse('Comment not found.', 'NOT_FOUND'));
    }

    const newLikeCount = Math.max((comment.likeCount || 0) - 1, 0);

    comment.likeCount = newLikeCount;
    await comment.save();

    return res.json(
      successResponse({
        id: comment._id,
        likeCount: comment.likeCount,
      })
    );
  } catch (err) {
    console.error('Error unliking comment:', err);
    return res
      .status(500)
      .json(errorResponse('Failed to unlike comment.', 'SERVER_ERROR'));
  }
});

/**
 * POST /api/comments/:id/report
 * Report a comment as inappropriate/spam/etc.
 *
 * Body:
 * - reason (optional string)
 * - type (optional string: "spam", "abuse", etc.)
 * - reporterId (optional)
 */
router.post('/:id/report', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      reason = null,
      type = 'other',
      reporterId = null,
    } = req.body || {};

    const update = {
      $set: {},
      $push: {},
    };

    // We mark the comment as "flagged" in status, but you can adjust in moderation logic
    update.$set.status = 'flagged';

    const flagEntry = {
      type,
      reason,
      reporterId,
      reportedAt: new Date(),
    };

    update.$push.flags = flagEntry;

    const updated = await Comment.findByIdAndUpdate(id, update, {
      new: true,
    });

    if (!updated) {
      return res
        .status(404)
        .json(errorResponse('Comment not found.', 'NOT_FOUND'));
    }

    return res.json(
      successResponse({
        message: 'Comment reported.',
        id: updated._id,
        status: updated.status,
        flags: updated.flags,
      })
    );
  } catch (err) {
    console.error('Error reporting comment:', err);
    return res
      .status(500)
      .json(errorResponse('Failed to report comment.', 'SERVER_ERROR'));
  }
});

/**
 * PATCH /api/comments/:id/moderate
 * Admin/moderator endpoint for changing comment status, adding moderator notes, etc.
 *
 * Body:
 * - status (optional: "visible", "hidden", "flagged", "blocked")
 * - moderatorNote (optional string)
 */
router.patch('/:id/moderate', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, moderatorNote } = req.body || {};

    const update = {};

    if (status) update.status = status;
    if (moderatorNote) update.moderatorNote = moderatorNote;

    if (Object.keys(update).length === 0) {
      return res.status(400).json(
        errorResponse(
          'No moderation fields provided.',
          'VALIDATION_ERROR',
          { fields: ['status', 'moderatorNote'] }
        )
      );
    }

    const updated = await Comment.findByIdAndUpdate(id, update, {
      new: true,
    });

    if (!updated) {
      return res
        .status(404)
        .json(errorResponse('Comment not found.', 'NOT_FOUND'));
    }

    return res.json(successResponse(updated));
  } catch (err) {
    console.error('Error moderating comment:', err);
    return res
      .status(500)
      .json(errorResponse('Failed to moderate comment.', 'SERVER_ERROR'));
  }
});

module.exports = router;