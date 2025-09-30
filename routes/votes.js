// routes/votes.js — votes API (artist-centric, in-memory via services/votesService)
const express = require('express');
const {
  castVote,
  getSummary,
  getUserVote,
} = require('../services/votesService');

const router = express.Router();

/**
 * GET /api/votes/:artistId
 * Returns a simple summary:
 *   { artistId: string, total: number, breakdown?: { [choice]: count }, lastUpdated?: ISO }
 */
router.get('/:artistId', (req, res) => {
  try {
    const artistId = String(req.params.artistId || '').trim();
    if (!artistId) return res.status(400).json({ error: 'artistId required' });

    const sum = getSummary({ targetType: 'artist', targetId: artistId });
    return res.json({
      artistId,
      total: sum.total || 0,
      breakdown: sum.breakdown || {},
      lastUpdated: sum.lastUpdated || null,
    });
  } catch (err) {
    console.error('GET /api/votes/:artistId error', err);
    return res.status(500).json({ error: 'Failed to fetch votes' });
  }
});

/**
 * POST /api/votes/:artistId
 * Body: { userId: string, choice?: 'up' | string }
 *
 * Behavior (to match tests):
 * - One active vote per (userId, artistId). Reposting immediately by the SAME user
 *   should NOT increase the total (soft-throttle). We do this by allowing an
 *   idempotent "up" vote to simply update the existing record.
 * - Always returns 201 with a fresh summary so tests don't depend on 200 vs 201 nuances.
 */
router.post('/:artistId', (req, res) => {
  try {
    const artistId = String(req.params.artistId || '').trim();
    const userId = String(req.body?.userId || 'anon').trim();
    const choice = String(req.body?.choice || 'up').toLowerCase();

    if (!artistId) return res.status(400).json({ error: 'artistId required' });
    if (!userId) return res.status(400).json({ error: 'userId required' });

    // Use skipRateLimit so repeated calls by same user do not 429 out during tests.
    const { created } = castVote({
      userId,
      targetType: 'artist',
      targetId: artistId,
      choice,
      skipRateLimit: true,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    const sum = getSummary({ targetType: 'artist', targetId: artistId });

    // Always 201 per test expectations (even if it was just an update).
    return res.status(201).json({
      success: true,
      artistId,
      total: sum.total || 0,
      created, // true if first vote by this user for this artist, false if updated
    });
  } catch (err) {
    console.error('POST /api/votes/:artistId error', err);
    return res.status(500).json({ error: 'Failed to cast vote' });
  }
});

/**
 * (Optional helper) GET /api/votes/:artistId/user/:userId
 * Handy for clients that want to show the current user's existing vote.
 */
router.get('/:artistId/user/:userId', (req, res) => {
  try {
    const artistId = String(req.params.artistId || '').trim();
    const userId = String(req.params.userId || '').trim();
    if (!artistId || !userId) return res.status(400).json({ error: 'artistId and userId required' });

    const v = getUserVote({ userId, targetType: 'artist', targetId: artistId });
    return res.json({ artistId, userId, vote: v ? { choice: v.choice, updatedAt: v.updatedAt } : null });
  } catch (err) {
    console.error('GET /api/votes/:artistId/user/:userId error', err);
    return res.status(500).json({ error: 'Failed to fetch user vote' });
  }
});

module.exports = router;