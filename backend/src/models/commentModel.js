// backend/src/models/commentModel.js
// iBand - Comment model (future-proof, aligned with comments router)

const mongoose = require('mongoose');

const { Schema } = mongoose;

// Subdocument for comment reports/flags
const CommentFlagSchema = new Schema(
  {
    type: {
      type: String,
      default: 'other',
      trim: true,
    }, // e.g. "spam", "abuse", "other"
    reason: {
      type: String,
      default: null,
      trim: true,
    },
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reportedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const CommentSchema = new Schema(
  {
    // Which artist this comment belongs to
    artistId: {
      type: Schema.Types.ObjectId,
      ref: 'Artist',
      required: true,
      index: true,
    },

    // Comment content
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    // Parent comment for replies (null = top-level)
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
      index: true,
    },

    // Optional user linkage (for when you have auth later)
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    // Display details (works even without full auth system)
    userDisplayName: {
      type: String,
      default: 'Anonymous',
      trim: true,
    },
    userAvatarUrl: {
      type: String,
      default: null,
      trim: true,
    },

    // Aggregate counters
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

    // Moderation / visibility fields
    isPinned: {
      type: Boolean,
      default: false,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ['visible', 'hidden', 'flagged', 'blocked'],
      default: 'visible',
      index: true,
    },

    // Reports
    flags: {
      type: [CommentFlagSchema],
      default: [],
    },

    moderatorNote: {
      type: String,
      default: null,
      trim: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    // Future anti-abuse / analytics fields
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    deviceId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// Helpful indexes for common queries
CommentSchema.index({ artistId: 1, parentId: 1, createdAt: -1 });
CommentSchema.index({ artistId: 1, status: 1, createdAt: -1 });
CommentSchema.index({ parentId: 1, createdAt: -1 });
CommentSchema.index({ userId: 1, createdAt: -1 });

const Comment = mongoose.model('Comment', CommentSchema);

module.exports = Comment;