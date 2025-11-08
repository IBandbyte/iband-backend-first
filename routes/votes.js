// routes/votes.js
/* eslint-env node */

const express = require('express');
const mongoose = require('mongoose');
const { isObjectId } = require('../utils/isObjectId');

const router = express.Router();

/* ------------------------------
 * Models (shared collections)
 * ---------------------------- */
const Artist =
  mongoose.models.Artist ||
  mongoose.model(
    'Artist',
    new mongoose.Schema(
      {
        name: { type: String, required: true, trim: true },
        genre: { type: String, default: '' },
        votes: { type: Number, default: 0 },
        commentsCount: { type: Number, default: 0 },
      },
      { collection: 'artists', timestamps: false }
    )
  );

const Vote =
  mongoose.models.Vote ||
  mongoose.model(
    'Vote',
    new mongoose.Schema(
      {
        artistId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Artist',
          index: true,
          required: true,
        },
        // Optional: track IP or user token later if you want anti-spam
        meta: { type: Object, default: {} },
      },
      { collection: 'votes', timestamps: true }
    )
  );

/* ------------------------------
 * Helpers
 * ---------------------------- */
function bad(res, code, msg) {
  return res.status(code).json({ ok: false, error: msg });
}

/* ------------------------------
 * GET /votes
 * Returns a simple top list: [{ _id: artistId, votes }, ...]
 * ---------------------------- */
router.get('/votes', async (_req, res) => {
  try {
    const agg = await Artist.aggregate([
      { $project: { votes: 1 } },
      { $sort: { votes: -1 } },
      { $limit: 100 },
    ]);
    return res.json(agg);
  } catch (_e) {
    return bad(res, 500, 'Failed to fetch votes');
  }
});

/* ------------------------------
 * GET /votes/:id
 * Return current vote count for a single artist
 * ---------------------------- */
router.get('/votes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return bad(res, 400, 'Invalid artist id');

    const art = await Artist.findById(id, { votes: 1, name: 1 }).lean();
    if (!art) return bad(res, 404, 'Artist not found');

    return res.json({ id: String(art._id), name: art.name, votes: art.votes || 0 });
  } catch (_e) {
    return bad(res, 500, 'Failed to fetch artist votes');
  }
});

/* ------------------------------
 * POST /artists/:id/vote
 * Body (optional): { delta: +1 | -1 } default +1
 * ---------------------------- */
router.post('/artists/:id/vote', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return bad(res, 400, 'Invalid artist id');

    let delta = 1;
    if (req.body && typeof req.body.delta !== 'undefined') {
      const n = Number(req.body.delta);
      if (![1, -1].includes(n)) return bad(res, 400, 'delta must be +1 or -1');
      delta = n;
    }

    const updated = await Artist.findByIdAndUpdate(
      id,
      { $inc: { votes: delta } },
      { new: true, projection: { name: 1, votes: 1 } }
    ).lean();

    if (!updated) return bad(res, 404, 'Artist not found');

    // Optional audit row — safe to keep for analytics; can be removed if undesired
    await Vote.create({ artistId: updated._id, meta: { delta } });

    return res.status(200).json({
      ok: true,
      id: String(updated._id),
      name: updated.name,
      votes: updated.votes || 0,
    });
  } catch (_e) {
    return bad(res, 500, 'Failed to cast vote');
  }
});

module.exports = router;