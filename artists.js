/* eslint-env node */

// artists.js — iBandbyte Artists API
// - GET  /artists                 -> list artists (lean projection)
// - GET  /artists/:id             -> single artist (safe id handling)
// - POST /artists/:id/vote        -> bump votes (+1 | -1)  [convenience]
//   (canonical voting endpoints also live in routes/votes.js)

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// Minimal, shared Artist model
const Artist =
  mongoose.models.Artist ||
  mongoose.model(
    'Artist',
    new mongoose.Schema(
      {
        name: { type: String, required: true, trim: true },
        genre: { type: String, default: '', trim: true },
        votes: { type: Number, default: 0 },
        commentsCount: { type: Number, default: 0 },
      },
      { collection: 'artists', timestamps: false }
    )
  );

// Helpers
const isObjectId = (v) => {
  if (!v) return false;
  if (v instanceof mongoose.Types.ObjectId) return true;
  return typeof v === 'string' && mongoose.Types.ObjectId.isValid(v);
};

// GET /artists — list
router.get('/', async (_req, res) => {
  try {
    const list = await Artist.find(
      {},
      { name: 1, genre: 1, votes: 1, commentsCount: 1 }
    )
      .sort({ name: 1 })
      .lean();
    return res.json(list);
  } catch (_e) {
    return res.status(500).json({ error: 'Failed to fetch artists' });
  }
});

// GET /artists/:id — single (safe)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Accept ObjectId or string id stored as _id
    let artist = null;
    if (isObjectId(id)) {
      artist = await Artist.findById(id, {
        name: 1,
        genre: 1,
        votes: 1,
        commentsCount: 1,
      }).lean();
    }
    if (!artist) {
      artist = await Artist.findOne(
        { _id: id },
        { name: 1, genre: 1, votes: 1, commentsCount: 1 }
      ).lean();
    }

    if (!artist) return res.status(404).json({ error: 'Artist not found' });
    return res.json(artist);
  } catch (_e) {
    return res.status(500).json({ error: 'Failed to fetch artist' });
  }
});

// POST /artists/:id/vote — convenience vote route
// Body: { delta: +1 | -1 } default +1
router.post('/:id/vote', async (req, res) => {
  try {
    const { id } = req.params;

    // Allow string _id or ObjectId
    const findById = isObjectId(id);
    let delta = 1;
    if (req.body && typeof req.body.delta !== 'undefined') {
      const n = Number(req.body.delta);
      if (![1, -1].includes(n)) {
        return res.status(400).json({ error: 'delta must be +1 or -1' });
      }
      delta = n;
    }

    let updated = null;
    if (findById) {
      updated = await Artist.findByIdAndUpdate(
        id,
        { $inc: { votes: delta } },
        { new: true, projection: { name: 1, votes: 1 } }
      ).lean();
    }
    if (!updated) {
      updated = await Artist.findOneAndUpdate(
        { _id: id },
        { $inc: { votes: delta } },
        { new: true, projection: { name: 1, votes: 1 } }
      ).lean();
    }

    if (!updated) return res.status(404).json({ error: 'Artist not found' });

    return res.json({
      id: String(updated._id),
      name: updated.name,
      votes: updated.votes || 0,
    });
  } catch (_e) {
    return res.status(500).json({ error: 'Failed to update vote' });
  }
});

module.exports = router;