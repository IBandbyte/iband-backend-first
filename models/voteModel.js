// models/voteModel.js
// iBand - Vote model (root-level version)
//
// This stores individual fan votes and links them to an Artist.
// We also keep handy metadata so we can analyse votes in future
// (device, IP, etc).

const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema(
  {
    artist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Artist',
      required: true,
    },
    // For future: could be +1 / -1 or different weightings
    value: {
      type: Number,
      default: 1,
    },
    // Simple anti-abuse / analytics fields
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    // Free-form extra data if we ever need it (campaign, ballot, etc.)
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Vote', voteSchema);