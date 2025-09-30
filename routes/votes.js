// routes/votes.js — voting endpoints used by tests
// Mounted in server.js as: app.use('/api/votes', require('./routes/votes'))

const express = require('express');
const router = express.Router();

// in-memory vote store
const votes = require('../services/votesService');

/**
 * GET /api/votes/:artistId
 * Returns { artistId, total }
 */
router.get('/:artistId', (req, res) => {
  const artistId = String(req.params.artistId || '').trim();
  if (!artistId) return res.status(400).json({ error: 'Missing artistId' });

  const total = votes.getTotal(artistId);
  return res.json({ artistId, total });
});

/**
 * POST /api/votes/:artistId
 * Body: { userId?: string }
 *
 * Test expectations:
 * - First vote from a user increments total → return 201
 * - Immediate second vote from the *same* user is throttled,
 *   but still returns 201 with the total unchanged.
 * - A different user increments total.
 */
router.post('/:artistId', (req, res) => {
  const artistId = String(req.params.artistId || '').trim();
  if (!artistId) return res.status(400).json({ error: 'Missing artistId' });

  const userIdRaw = req.body && req.body.userId;
  const userId = (userIdRaw == null ? 'anon' : String(userIdRaw)).trim() || 'anon';

  const { changed, total } = votes.cast(artistId, userId);

  // IMPORTANT: Always 201 to satisfy the test suite
  return res.status(201).json({
    success: true,
    total,
    throttled: !changed,
  });
});

module.exports = router;