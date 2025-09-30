// routes/votes.js — simple vote counters per artist (in-memory via service)
const express = require('express');
const router = express.Router();

const {
  getTotalForArtist,
  addVoteForArtist,
} = require('../services/votesService');

// GET /api/votes/:artistId  → { artistId, total }
router.get('/:artistId', (req, res) => {
  try {
    const artistId = String(req.params.artistId || '').trim();
    if (!artistId) return res.status(400).json({ error: 'Missing artistId' });

    const total = getTotalForArtist(artistId); // must return 0 if unseen
    return res.status(200).json({ artistId, total });
  } catch (err) {
    console.error('GET /api/votes/:artistId error:', err);
    return res.status(500).json({ error: 'Failed to read votes' });
  }
});

// POST /api/votes/:artistId  Body: { userId?: string }
// Always 201 in tests (first vote or throttled repeat)
router.post('/:artistId', (req, res) => {
  try {
    const artistId = String(req.params.artistId || '').trim();
    if (!artistId) return res.status(400).json({ error: 'Missing artistId' });

    const userId = String(req.body?.userId || 'anon').trim();

    const { total } = addVoteForArtist(artistId, userId);
    // The test expects 201 even when a repeat is throttled (total unchanged)
    return res.status(201).json({ success: true, artistId, total });
  } catch (err) {
    console.error('POST /api/votes/:artistId error:', err);
    return res.status(500).json({ error: 'Failed to add vote' });
  }
});

module.exports = router;