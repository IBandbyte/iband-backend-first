// models/commentModel.js
// iBand - Comment model (MongoDB / Mongoose)
// Fully moderation-ready: likes, flags, soft-delete, status, timestamps.

const mongoose = require("mongoose");

// Embedded subdocument for individual flags
const flagSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      default: "other",
      trim: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    reporterId: {
      type: String,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const commentSchema = new mongoose.Schema(
  {
    // Artist this comment belongs to
    artistId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    // Comment body text
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    // Threading (optional)
    parentId: {
      type: String,
      default: null,
    },
    replyCount: {
      type: Number,
      default: 0,
    },

    // Basic user/fan info (no auth yet)
    userId: {
      type: String,
      default: null,
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
    },

    // Device / meta (optional, for later analytics / anti-abuse)
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

    // Engagement
    likeCount: {
      type: Number,
      default: 0,
    },

    // Moderation state
    status: {
      type: String,
      enum: ["visible", "pending", "flagged", "rejected", "deleted"],
      default: "visible",
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

    // Flags for abuse/spam/etc.
    flags: [flagSchema],
  },
  {
    timestamps: true, // createdAt + updatedAt
  }
);

const Comment = mongoose.model("Comment", commentSchema);

module.exports = Comment;