// models/commentModel.js
// Mongo-backed comments for iBand
//
// Supports comments on multiple target types so later we can
// comment on artists, tracks, live clips, etc. For now the frontend
// will mostly use targetType = 'artist'.

const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    // What this comment is attached to
    targetType: {
      type: String,
      enum: ['artist', 'content', 'other'],
      default: 'artist',
      index: true,
    },

    // Flexible string so it works with artists, tracks, etc.
    // For artists you’ll store the artist’s _id as a string.
    targetId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    // Basic author info (no auth yet – can be fan name or handle)
    authorName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    authorHandle: {
      type: String,
      trim: true,
      maxlength: 80,
    },

    // The actual comment text
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    // Moderation / UI flags
    isPinned: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Extra metadata (optional, useful later)
    meta: {
      ip: { type: String, maxlength: 64 },
      userAgent: { type: String, maxlength: 256 },
    },
  },
  {
    timestamps: true, // adds createdAt + updatedAt
  }
);

const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment;