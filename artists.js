/* eslint-env node */

const express = require('express');
const mongoose = require('mongoose');
const { isObjectIdLike } = require('./src/utils/isObjectId');

const router = express.Router();

// extra body parsers (defensive)
router.use(express.json({ type: ['application/json', 'application/*+json', '*/*'] }));
router.use(express.urlencoded({ extended: true }));

const Artist =
  mongoose.models.Artist ||
  mongoose.model(
    'Artist',
    new mongoose.Schema(
      {
        name: { type: String, required: true, trim: true },
        genre: { type: String, default: 'No genre set', trim: true },
        votes: { type: Number, default: 0 },
        commentsCount: { type: Number, default: 0 },
      },
      { collection: 'artists' }
    )
  );

// GET /artists
router.get('/', async (_req, res) => {
  try {
    const list = await Artist.find({}, { name: 1, genre: 1, votes: 1, commentsCount: 1 })
      .sort({ name: 1 })
      .lean();
    return res.status(200).json(list);
  } catch (_e) {
    return res.status(500).json({ error: 'Failed to fetch artists' });
  }
});

// GET /artists/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!isObjectIdLike(id)) return res.status(400).json({ error: 'Invalid artist id' });
  try {
    const artist = await Artist.findById(id, { name: 1, genre: 1, votes: 1, commentsCount: 1 }).lean();
    if (!artist) return res.status(404).json({ error: 'Artist not found' });
    return res.json(artist);
  } catch (_e) {
    return res.status(500).json({ error: 'Failed to fetch artist' });
  }
});

// POST /artists/:id/vote   Body: { "delta": 1 | -1 }
router.post('/:id/vote', async (req, res) => {
  const { id } = req.params;

  // accept delta from JSON, form-encoded, or text/plain containing JSON
  let delta = 1;
  const b = req.body;
  if (b && typeof b === 'object' && !Buffer.isBuffer(b) && b.delta !== undefined) {
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

    return res.json({ id: String(updated._id), name: updated.name, votes: updated.votes || 0 });
  } catch (_e) {
    return res.status(500).json({ error: 'Failed to update vote' });
  }
});

module.exports = router;