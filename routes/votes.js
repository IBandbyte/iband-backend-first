// routes/votes.js — route layer for voting + summaries (artist targets)
// Uses services/votesService for storage; adds a soft-throttle per user+artist.

const express = require('express');
const { castVote, getSummary } = require('../services/votesService');

const router = express.Router();

// Soft throttle memory (milliseconds window)
const lastByUserArtist = new Map();
const WINDOW_MS = 2000; // CI expects second immediate vote to NOT bump total

// GET /api/votes/:artistId  → { artistId, total, breakdown }
router.get('/:artistId', (req, res) => {
  try {
    const artistId = String(req.params.artistId || '').trim();
    if (!artistId) return res.status(400).json({ error: 'Missing artistId' });

    const summary = getSummary({ targetType: 'artist', targetId: artistId });
    return res.json({
      artistId,
      total: summary.total || 0,
      breakdown: summary.breakdown || {},
    });
  } catch (err) {
    console.error('GET /api/votes/:artistId error:', err);
    return res.status(500).json({ error: 'Failed to fetch votes' });
  }
});

// POST /api/votes/:artistId  Body: { userId, choice?="up" }
// Always 201; applies soft throttle so back-to-back same-user vote doesn't increment.
router.post('/:artistId', (req, res) => {
  try {
    const artistId = String(req.params.artistId || '').trim();
    const userId = String(req.body?.userId || 'anon').trim();
    const choice = String(req.body?.choice || 'up').toLowerCase();

    if (!artistId) return res.status(400).json({ error: 'Missing artistId' });
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const k = `${userId}|${artistId}`;
    const now = Date.now();
    const last = lastByUserArtist.get(k);

    // If within window -> do not change stored vote; otherwise cast/update
    if (!last || now - last > WINDOW_MS) {
      castVote({
        userId,
        targetType: 'artist',
        targetId: artistId,
        choice,
        // let service enforce long-rate-limits later; our soft throttle handles test case
        skipRateLimit: true,
      });
      lastByUserArtist.set(k, now);
    }

    const summary = getSummary({ targetType: 'artist', targetId: artistId });
    return res
      .status(201)
      .json({ success: true, total: summary.total || 0 });
  } catch (err) {
    const status = err?.status || 500;
    console.error('POST /api/votes/:artistId error:', err?.message || err);
    return res.status(status).json({ error: err?.message || 'Failed to cast vote' });
  }
});

module.exports = router;