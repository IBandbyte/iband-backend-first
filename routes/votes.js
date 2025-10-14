// routes/votes.js — lightweight Votes API that uses services/votesService.js
const express = require('express');
const votesService = require('../services/votesService');

const router = express.Router();

/**
 * GET /api/votes/:targetId
 * Returns summary for artist target (targetType defaults to 'artist' for compatibility with tests)
 * Response shape: { targetType, targetId, total, breakdown, lastUpdated }
 */
router.get('/:targetId', async (req, res) => {
  try {
    const targetId = (req.params.targetId || '').toString().trim();
    if (!targetId) return res.status(400).json({ error: 'Missing targetId' });

    const summary = votesService.getSummary({ targetType: 'artist', targetId });
    res.status(200).json(summary);
  } catch (err) {
    console.error('GET /api/votes/:targetId error:', err);
    res.status(500).json({ error: 'Failed to fetch votes' });
  }
});

/**
 * POST /api/votes/:targetId
 * Body: { userId?: string, choice?: string }
 * Creates or updates user's vote; enforces soft rate-limit in service (unless skipRateLimit passed)
 *
 * Returns 201 when a new vote was created, 200 when updated.
 * Response includes success and the current total via getSummary.
 */
router.post('/:targetId', async (req, res) => {
  try {
    const targetId = (req.params.targetId || '').toString().trim();
    if (!targetId) return res.status(400).json({ error: 'Missing targetId' });

    const userId = (req.body?.userId || 'anon').toString().slice(0, 120);
    const choice = (req.body?.choice || 'up').toString().slice(0, 40);

    const result = votesService.castVote({
      userId,
      targetType: 'artist',
      targetId,
      choice,
      ip: req.ip,
      userAgent: req.get('User-Agent') || '',
    });

    // compute summary for response
    const summary = votesService.getSummary({ targetType: 'artist', targetId });

    if (result && result.created) {
      res.status(201).json({ success: true, created: true, total: summary.total });
    } else {
      res.status(200).json({ success: true, created: false, total: summary.total });
    }
  } catch (err) {
    // rate-limit produced a 429-like error in votesService
    if (err && err.status === 429) {
      return res.status(429).json({ error: err.message });
    }
    console.error('POST /api/votes/:targetId error:', err);
    res.status(500).json({ error: 'Failed to cast vote' });
  }
});

module.exports = router;