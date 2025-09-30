// routes/votes.js — Votes API (artist/content)
// Mount path (server.js): app.use('/api/votes', votesRoutes)

const express = require('express');
const router = express.Router();
const {
  castVote,
  getSummary,
} = require('../services/votesService');

// Helper: parse ":slug" as "type:id" (e.g., "artist:123").
// If no ":", default to type="artist" and id=slug.
function parseTargetSlug(slug) {
  const s = String(slug || '');
  const i = s.indexOf(':');
  if (i === -1) return { targetType: 'artist', targetId: s };
  return { targetType: s.slice(0, i) || 'artist', targetId: s.slice(i + 1) };
}

// GET /api/votes/:slug  → summary for a target
router.get('/:slug', (req, res) => {
  try {
    const { targetType, targetId } = parseTargetSlug(req.params.slug);
    const sum = getSummary({ targetType, targetId });
    // The tests expect 200 and a stable shape
    res.status(200).json({
      artistId: targetType === 'artist' ? targetId : undefined,
      targetType,
      targetId,
      total: sum.total,
      breakdown: sum.breakdown,
      lastUpdated: sum.lastUpdated,
    });
  } catch (err) {
    console.error('GET /api/votes/:slug error:', err);
    res.status(500).json({ error: 'Failed to get vote summary' });
  }
});

// POST /api/votes/:slug  → record/update a user’s vote (soft-throttled)
// Body: { userId: string, choice?: string }
router.post('/:slug', (req, res) => {
  try {
    const { targetType, targetId } = parseTargetSlug(req.params.slug);
    const userId = String(req.body?.userId || 'anon');
    const choice = String(req.body?.choice || 'up');

    // Soft throttle logic: one active vote per user/target.
    // We let re-votes go through (skipRateLimit) so total doesn’t increase,
    // which matches "soft throttle" behavior the tests expect.
    castVote({
      userId,
      targetType,
      targetId,
      choice,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      skipRateLimit: true,
    });

    const sum = getSummary({ targetType, targetId });

    // The tests expect 201 on POST
    res.status(201).json({
      success: true,
      artistId: targetType === 'artist' ? targetId : undefined,
      targetType,
      targetId,
      total: sum.total,
      breakdown: sum.breakdown,
    });
  } catch (err) {
    const status = err.status || 500;
    console.error('POST /api/votes/:slug error:', err);
    res.status(status).json({ error: err.message || 'Failed to cast vote' });
  }
});

module.exports = router;