// models/commentModel.js
// iBand - Comment model (MongoDB/Mongoose)
// Supports artist comments with moderation + metrics.

const mongoose = require("mongoose");

const { Schema } = mongoose;

// A single flag entry (who reported, why)
const flagSchema = new Schema(
  {
    type: {
      type: String,
      default: "other",
      trim: true,
      maxlength: 40,
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
      maxlength: 120,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const commentSchema = new Schema(
  {
    // Which artist this comment belongs to
    artistId: {
      type: Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
      index: true,
    },

    // Nested replies
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },

    // Main content
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    // Optional user info (no auth yet)
    userId: {
      type: String,
      default: null,
      trim: true,
      maxlength: 120,
    },
    userDisplayName: {
      type: String,
      default: "Anonymous",
      trim: true,
      maxlength: 80,
    },
    userAvatarUrl: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },

    // Device / request metadata (for later abuse detection)
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
      maxlength: 120,
    },

    // Engagement counters
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

    // Moderation & UI state
    status: {
      type: String,
      enum: ["visible", "hidden", "blocked", "flagged"],
      default: "visible",
      index: true,
    },
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
    deletedAt: {
      type: Date,
      default: null,
    },

    // All flags raised by users / admins
    flags: {
      type: [flagSchema],
      default: [],
    },
  },
  {
    timestamps: true, // createdAt + updatedAt
  }
);

// Helpful indexes for common queries
commentSchema.index({ artistId: 1, isDeleted: 1, createdAt: -1 });
commentSchema.index({ status: 1, isDeleted: 1, createdAt: -1 });
commentSchema.index({ isPinned: -1, likeCount: -1, createdAt: -1 });

const Comment = mongoose.model("Comment", commentSchema);

module.exports = Comment;