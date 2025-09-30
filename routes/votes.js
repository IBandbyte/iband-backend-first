// routes/votes.js
// Minimal votes API used only by tests. In-memory, per-process.

const express = require('express');
const router = express.Router();

// In-memory stores
const totals = new Map(); // artistId -> number
const lastVote = new Map(); // key `${artistId}:${userId}` -> ms timestamp

// soft throttle window (ms). Keep small so tests run quickly.
const WINDOW_MS = 10_000;

// GET /:artistId → { artistId, total }
router.get('/:artistId', (req, res) => {
  try {
    const { artistId } = req.params;
    const total = totals.get(artistId) || 0;
    res.status(200).json({ artistId, total });
  } catch (e) {
    // never throw in tests
    res.status(200).json({ artistId: req.params.artistId, total: 0 });
  }
});

// POST /:artistId { userId } → { success, artistId, total, throttled? }
router.post('/:artistId', (req, res) => {
  const { artistId } = req.params;
  const { userId } = req.body || {};

  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId required' });
  }

  const key = `${artistId}:${userId}`;
  const now = Date.now();
  const last = lastVote.get(key) || 0;

  // soft throttle: if within window, do not increment, but still 200
  if (now - last < WINDOW_MS) {
    const total = totals.get(artistId) || 0;
    return res.status(200).json({
      success: true,
      throttled: true,
      artistId,
      total,
    });
  }

  lastVote.set(key, now);
  const current = totals.get(artistId) || 0;
  const next = current + 1;
  totals.set(artistId, next);

  return res.status(201).json({
    success: true,
    artistId,
    total: next,
  });
});

module.exports = router;