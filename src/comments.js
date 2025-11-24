// src/comments.js
// iBand - Comments Router (mounted by server.js at /comments)

const express = require('express');
const mongoose = require('mongoose');
const Comment = require('../models/commentModel');

const router = express.Router();

// Small helper to validate Mongo IDs
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
    // If it's a validation error, send 400 so we can see it's bad input
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    return res.status(500).json({ error: 'Server error creating comment' });
  }
});

// ---------------------------------------------------------
// 2️⃣ Get all comments for an artist
// GET /comments/:artistId
// ---------------------------------------------------------
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

    const updated = await Comment.findByIdAndUpdate(
      commentId,
      {
        status: 'flagged',
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

module.exports = router;