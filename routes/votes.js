/* eslint-env node */

// routes/votes.js — Votes API (mounted at /api/votes)
// Endpoints:
//   GET    /api/votes/leaderboard?limit=10   -> top artists by votes
//   GET    /api/votes?artistId=<id>          -> current votes for one artist
//   POST   /api/votes                        -> { artistId, delta? } increment

const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

/** -------------------------------------------
 * Minimal Artist model (reuse existing)
 * ----------------------------------------- */
const Artist =
  mongoose.models.Artist ||
  mongoose.model(
    'Artist',
    new mongoose.Schema(
      {
        name: String,
        genre: String,
        votes: { type: Number, default: 0 },
        commentsCount: { type: Number, default: 0 },
      },
      { collection: 'artists' }
    )
  );

/** -------------------------------------------
 * Helpers
 * ----------------------------------------- */
const isObjId = (id) => mongoose.isValidObjectId(id);
const bad = (res, status, msg) => res.status(status).json({ ok: false, error: msg });

/** -------------------------------------------
 * GET /api/votes/leaderboard?limit=10
 * ----------------------------------------- */
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
    const list = await Artist.find({})
      .select('name genre votes commentsCount')
      .sort({ votes: -1, name: 1 })
      .limit(limit)
      .lean()
      .exec();

    return res.json(
      list.map((a) => ({
        _id: a._id?.toString(),
        name: a.name,
        genre: a.genre || 'No genre set',
        votes: typeof a.votes === 'number' ? a.votes : 0,
        commentsCount: a.commentsCount || 0,
      }))
    );
  } catch (_e) {
    return bad(res, 500, 'Failed to fetch leaderboard');
  }
});

/** -------------------------------------------
 * GET /api/votes?artistId=<id>
 * Returns current vote count for an artist
 * ----------------------------------------- */
router.get('/', async (req, res) => {
  try {
    const { artistId } = req.query || {};
    if (!artistId || !isObjId(artistId)) return bad(res, 400, 'artistId (ObjectId) is required');

    const doc = await Artist.findById(artistId).select('votes name').lean();
    if (!doc) return bad(res, 404, 'Artist not found');

    return res.json({ ok: true, artistId, name: doc.name, votes: doc.votes || 0 });
  } catch (_e) {
    return bad(res, 500, 'Failed to fetch votes');
  }
});

/** -------------------------------------------
 * POST /api/votes
 * Body: { artistId, delta? }  (delta defaults to +1)
 * ----------------------------------------- */
router.post('/', async (req, res) => {
  try {
    const { artistId } = req.body || {};
    let { delta } = req.body || {};

    if (!artistId || !isObjId(artistId)) return bad(res, 400, 'artistId (ObjectId) is required');

    // normalize delta
    if (typeof delta !== 'number' || !Number.isFinite(delta)) delta = 1;
    delta = Math.trunc(delta);

    const doc = await Artist.findById(artistId).exec();
    if (!doc) return bad(res, 404, 'Artist not found');

    doc.votes = Math.max(0, (doc.votes || 0) + delta);
    await doc.save();

    return res.status(200).json({ ok: true, artistId, votes: doc.votes });
  } catch (_e) {
    return bad(res, 500, 'Failed to apply vote');
  }
});

module.exports = router;