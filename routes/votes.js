/* eslint-env node */

const express = require('express');
const mongoose = require('mongoose');
const { isObjectIdLike } = require('../src/utils/isObjectId');

const router = express.Router();
router.use(express.json({ type: ['application/json', 'application/*+json', '*/*'] }));
router.use(express.urlencoded({ extended: true }));

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

// GET /votes — list all artists (id + votes)
router.get('/votes', async (_req, res) => {
  try {
    const list = await Artist.find({}, { votes: 1, name: 1 }).sort({ votes: -1 }).lean();
    res.json(list.map(a => ({ id: String(a._id), name: a.name, votes: a.votes || 0 })));
  } catch (_e) {
    res.status(500).json({ error: 'Failed to fetch votes' });
  }
});

// GET /votes/:id — read votes for one artist
router.get('/votes/:id', async (req, res) => {
  const { id } = req.params;
  if (!isObjectIdLike(id)) return res.status(400).json({ error: 'Invalid artist id' });
  try {
    const a = await Artist.findById(id, { name: 1, votes: 1 }).lean();
    if (!a) return res.status(404).json({ error: 'Artist not found' });
    res.json({ id: String(a._id), name: a.name, votes: a.votes || 0 });
  } catch (_e) {
    res.status(500).json({ error: 'Failed to fetch vote' });
  }
});

// POST /artists/:id/vote — write handled in artists.js too (dup OK)
router.post('/artists/:id/vote', async (req, res) => {
  const { id } = req.params;
  let delta = 1;
  const b = req.body;
  if (b && typeof b === 'object' && b.delta !== undefined) {
    const n = Number(b.delta);
    if (Number.isFinite(n)) delta = Math.trunc(n);
  }
  if (!isObjectIdLike(id)) return res.status(400).json({ error: 'Invalid artist id' });
  if (![1, -1].includes(delta)) return res.status(400).json({ error: 'delta must be +1 or -1' });

  try {
    const updated = await Artist.findByIdAndUpdate(
      id,
      { $inc: { votes: delta } },
      { new: true, projection: { name: 1, votes: 1 } }
    ).lean();
    if (!updated) return res.status(404).json({ error: 'Artist not found' });

    res.json({ id: String(updated._id), name: updated.name, votes: updated.votes || 0 });
  } catch (_e) {
    res.status(500).json({ error: 'Failed to update vote' });
  }
});

module.exports = router;