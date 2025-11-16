// backend/src/models/voteModel.js
// iBand - Vote model (aligned with votes router)

const mongoose = require('mongoose');

const { Schema } = mongoose;

const VoteSchema = new Schema(
  {
    // Which artist this vote belongs to
    artistId: {
      type: Schema.Types.ObjectId,
      ref: 'Artist',
      required: true,
      index: true,
    },

    // Optional user linkage (for when you have auth later)
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    // Device identifier sent from the client (for duplicate detection)
    deviceId: {
      type: String,
      default: null,
      index: true,
      trim: true,
    },

    // Where the vote came from (web, app, campaign, tiktok, etc.)
    source: {
      type: String,
      default: 'unknown',
      trim: true,
      index: true,
    },

    // Optional campaign identifier (for special contests / promos)
    campaignId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    // Anti-abuse / analytics fields
    ipAddress: {
      type: String,
      default: null,
      trim: true,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// Helpful indexes for queries and analytics
VoteSchema.index({ artistId: 1, createdAt: -1 });
VoteSchema.index({ artistId: 1, campaignId: 1, createdAt: -1 });
VoteSchema.index({ userId: 1, createdAt: -1 });
VoteSchema.index({ deviceId: 1, createdAt: -1 });

const Vote = mongoose.model('Vote', VoteSchema);

module.exports = Vote;