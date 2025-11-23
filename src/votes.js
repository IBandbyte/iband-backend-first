// src/votes.js
// iBand - Votes router (mounted at /votes in server.js)

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Vote = require('../models/voteModel');      // root/models
const Artist = require('../models/artistModel');  // used for validation

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// ---------------------------------------------------------
// POST /votes/:artistId
// Cast a vote for an artist
// ---------------------------------------------------------
router.post('/:artistId', async (req, res) => {
  try {
    const { artistId } = req.params;
    const {
      userId = null,
      ipAddress = null,
      userAgent = null,
      deviceId = null,
    } = req.body || {};

    if (!isValidObjectId(artistId)) {
      return res.status(400).json({ error: 'Invalid artistId' });
    }

    // Optional: verify artist exists
    const artistExists = await Artist.exists({ _id: artistId });
    if (!artistExists) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    const vote = new Vote({
      artistId,
      userId,
      ipAddress,
      userAgent,
      deviceId,
    });

    await vote.save();

    // Return updated total votes for this artist
    const totalVotes = await Vote.countDocuments({ artistId });

    return res.status(201).json({
      success: true,
      vote,
      totalVotes,
    });
  } catch (err) {
    console.error('Error casting vote:', err);
    return res.status(500).json({ error: 'Server error casting vote' });
  }
});

// ---------------------------------------------------------
// GET /votes/:artistId
// Get total votes for a single artist
// ---------------------------------------------------------
router.get('/:artistId', async (req, res) => {
  try {
    const { artistId } = req.params;

    if (!isValidObjectId(artistId)) {
      return res.status(400).json({ error: 'Invalid artistId' });
    }

    const totalVotes = await Vote.countDocuments({ artistId });

    return res.json({ artistId, totalVotes });
  } catch (err) {
    console.error('Error fetching votes:', err);
    return res.status(500).json({ error: 'Server error fetching votes' });
  }
});

// ---------------------------------------------------------
// GET /votes
// Optional: get aggregated vote counts for all artists
// ---------------------------------------------------------
router.get('/', async (_req, res) => {
  try {
    const aggregation = await Vote.aggregate([
      { $group: { _id: '$artistId', totalVotes: { $sum: 1 } } },
      { $sort: { totalVotes: -1 } },
    ]);

    return res.json(aggregation);
  } catch (err) {
    console.error('Error aggregating votes:', err);
    return res.status(500).json({ error: 'Server error aggregating votes' });
  }
});

module.exports = router;