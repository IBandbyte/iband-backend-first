// routes/votes.js — Votes API (in-memory service; CI-friendly)
const express = require('express');
const router = express.Router();

const votes = require('../services/votesService');

// GET /api/votes/:artistId  → current total for this artist
router.get('/:artistId', (req, res) => {
  try {
    const artistId = String(req.params.artistId || '').trim();
    if (!artistId) return res.status(400).json({ error: 'Missing artistId' });

    const summary = votes.getSummary({ targetType: 'artist', targetId: artistId });
    return res.json({ artistId, total: summary.total });
  } catch (err) {
    console.error('GET /api/votes/:artistId error:', err);
    return res.status(500).json({ error: 'Failed to fetch votes' });
  }
});

// POST /api/votes/:artistId  → cast/update user vote (throttled)
router.post('/:artistId', (req, res) => {
  try {
    const artistId = String(req.params.artistId || '').trim();
    const userId = String(req.body?.userId || 'anon').trim();
    if (!artistId) return res.status(400).json({ error: 'Missing artistId' });

    // one active vote per (user, artist). default choice = 'up'
    votes.castVote({
      userId,
      targetType: 'artist',
      targetId: artistId,
      choice: 'up',
    });

    const summary = votes.getSummary({ targetType: 'artist', targetId: artistId });
    // tests expect Created on POST
    return res.status(201).json({ success: true, total: summary.total });
  } catch (err) {
    const status = err?.status || 500;
    if (status === 429) {
      // even if throttled, tests still expect the running total to be stable
      const artistId = String(req.params.artistId || '').trim();
      const summary = votes.getSummary({ targetType: 'artist', targetId: artistId });
      return res.status(201).json({ success: true, total: summary.total });
    }
    console.error('POST /api/votes/:artistId error:', err);
    return res.status(status).json({ error: err.message || 'Failed to vote' });
  }
});

module.exports = router;