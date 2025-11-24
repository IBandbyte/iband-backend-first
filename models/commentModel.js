// models/commentModel.js
// iBand – Comment model that matches src/comments.js router

const mongoose = require('mongoose');

const flagSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      default: 'other',
      trim: true,
    },
    reason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },
    reporterId: {
      type: String,
      default: null,
      trim: true,
      maxlength: 80,
    },
    flaggedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const commentSchema = new mongoose.Schema(
  {
    // The artist this comment belongs to
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Artist',
      required: true,
      index: true,
    },

    // Actual comment text
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    // For threaded replies
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
      index: true,
    },

    // Optional user info (no auth yet)
    userId: {
      type: String,
      default: null,
      trim: true,
      maxlength: 80,
    },
    userDisplayName: {
      type: String,
      default: 'Anonymous',
      trim: true,
      maxlength: 80,
    },
    userAvatarUrl: {
      type: String,
      default: null,
      trim: true,
      maxlength: 300,
    },

    // Device / request metadata (optional)
    ipAddress: {
      type: String,
      default: null,
      trim: true,
      maxlength: 64,
    },
    userAgent: {
      type: String,
      default: null,
      trim: true,
      maxlength: 256,
    },
    deviceId: {
      type: String,
      default: null,
      trim: true,
      maxlength: 128,
    },

    // Engagement
    likeCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    replyCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Moderation
    status: {
      type: String,
      enum: ['visible', 'flagged', 'hidden'],
      default: 'visible',
      index: true,
    },
    flags: {
      type: [flagSchema],
      default: [],
    },

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt + updatedAt
  }
);

module.exports = mongoose.model('Comment', commentSchema);