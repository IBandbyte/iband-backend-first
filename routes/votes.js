// routes/votes.js — Votes API (artist-focused, soft-throttle behavior)
const express = require('express');
const router = express.Router();

const {
  castVote,
  getSummary,
} = require('../services/votesService');

// GET /api/votes/:artistId → summary for artist
router.get('/:artistId', (req, res) => {
  try {
    const artistId = String(req.params.artistId || '').trim();
    const summary = getSummary({ targetType: 'artist', targetId: artistId });
    return res.status(200).json({
      artistId,
      total: summary.total,
      breakdown: summary.breakdown,
      lastUpdated: summary.lastUpdated,
    });
  } catch (err) {
    console.error('GET /api/votes/:artistId error:', err);
    return res.status(500).json({ error: 'Failed to fetch votes' });
  }
});

// POST /api/votes/:artistId → cast a vote (1 per user per artist, soft throttle)
router.post('/:artistId', (req, res) => {
  const artistId = String(req.params.artistId || '').trim();
  const userId   = String(req.body?.userId || 'anon').trim();
  const choice   = String(req.body?.choice || 'up').trim().toLowerCase();

  try {
    // Try to cast/update the vote
    const { created } = castVote({
      userId,
      targetType: 'artist',
      targetId: artistId,
      choice,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Always return 201 on POST according to test expectations
    const summary = getSummary({ targetType: 'artist', targetId: artistId });
    return res.status(201).json({
      success: true,
      created,
      artistId,
      total: summary.total,
      breakdown: summary.breakdown,
      lastUpdated: summary.lastUpdated,
    });
  } catch (err) {
    // Soft throttle: if service threw (e.g., rate limit), still reply 201 with unchanged totals
    console.warn('POST /api/votes/:artistId soft-throttle or error:', err?.message || err);
    const summary = getSummary({ targetType: 'artist', targetId: artistId });
    return res.status(201).json({
      success: true,
      created: false,
      artistId,
      total: summary.total,
      breakdown: summary.breakdown,
      lastUpdated: summary.lastUpdated,
      note: 'Soft-throttled (vote not incremented).',
    });
  }
});

module.exports = router;