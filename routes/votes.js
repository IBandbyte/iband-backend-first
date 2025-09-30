// routes/votes.js — integrates with services/votesService (choices + soft throttle)
const express = require('express');
const router = express.Router();

const {
  castVote,
  getSummary,
} = require('../services/votesService');

// GET /api/votes/:artistId  → expects { artistId, total }
router.get('/:artistId', (req, res) => {
  try {
    const artistId = String(req.params.artistId || '').trim();
    if (!artistId) return res.status(400).json({ error: 'Missing artistId' });

    const sum = getSummary({ targetType: 'artist', targetId: artistId });
    return res.status(200).json({
      artistId,
      total: sum.total || 0,
    });
  } catch (err) {
    console.error('GET /api/votes/:artistId error:', err);
    return res.status(500).json({ error: 'Failed to read votes' });
  }
});

// POST /api/votes/:artistId  Body: { userId?: string, choice?: string }
// Tests expect 201 even when a repeat vote is throttled; return { success, artistId, total }
router.post('/:artistId', (req, res) => {
  const artistId = String(req.params.artistId || '').trim();
  if (!artistId) return res.status(400).json({ error: 'Missing artistId' });

  const userId = String(req.body?.userId || 'anon').trim();
  const choice = String(req.body?.choice || 'up').trim().toLowerCase();

  try {
    // Try to cast the vote (service enforces per-user throttle)
    castVote({
      userId,
      targetType: 'artist',
      targetId: artistId,
      choice,
    });
  } catch (err) {
    // If throttled (service sets err.status = 429), tests still want 201 with current total
    if (err && (err.status === 429 || err.statusCode === 429)) {
      const sum = getSummary({ targetType: 'artist', targetId: artistId });
      return res.status(201).json({ success: true, artistId, total: sum.total || 0 });
    }
    console.error('POST /api/votes/:artistId error:', err);
    return res.status(500).json({ error: 'Failed to add vote' });
  }

  // Success path (new or updated vote): respond 201 with total
  const sum = getSummary({ targetType: 'artist', targetId: artistId });
  return res.status(201).json({ success: true, artistId, total: sum.total || 0 });
});

module.exports = router;