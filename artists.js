/* eslint-env node */

// artists.js — list, detail, vote (robust for ObjectId or string _id)
const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

// ---------- Model ----------
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

// ---------- Helpers ----------
const isOid = (id) => mongoose.isValidObjectId(id);
const toLeanItem = (a) => ({
  _id: String(a._id),
  name: a.name,
  genre: a.genre || '',
  votes: typeof a.votes === 'number' ? a.votes : 0,
  commentsCount: typeof a.commentsCount === 'number' ? a.commentsCount : 0,
});
const parseBody = (req) => {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    const s = req.body.trim();
    if (s.startsWith('{') || s.startsWith('[')) {
      try { return JSON.parse(s); } catch { /* ignore */ }
    }
  }
  return {};
};

// ---------- GET /artists ----------
router.get('/', async (_req, res) => {
  try {
    const list = await Artist.find({}, { name: 1, genre: 1, votes: 1, commentsCount: 1 })
      .sort({ name: 1 })
      .lean();
    res.status(200).json(list.map(toLeanItem));
  } catch {
    res.status(500).json({ error: 'Failed to fetch artists' });
  }
});

// ---------- GET /artists/:id ----------
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    let doc = null;
    if (isOid(id)) doc = await Artist.findById(id, { name: 1, genre: 1, votes: 1, commentsCount: 1 }).lean();
    if (!doc) doc = await Artist.findOne({ _id: id }, { name: 1, genre: 1, votes: 1, commentsCount: 1 }).lean();

    if (!doc) return res.status(404).json({ error: 'Artist not found' });
    res.status(200).json(toLeanItem(doc));
  } catch {
    res.status(500).json({ error: 'Failed to fetch artist' });
  }
});

// ---------- POST /artists/:id/vote ----------
/*
  Body examples:
    { "delta": 1 }   // upvote
    { "delta": -1 }  // downvote
*/
router.post('/:id/vote', async (req, res) => {
  try {
    const { id } = req.params;
    const body = parseBody(req);
    const n = Number(body.delta);

    if (![1, -1].includes(n)) {
      return res.status(400).json({ error: 'delta must be +1 or -1' });
    }

    let updated = null;
    if (isOid(id)) {
      updated = await Artist.findByIdAndUpdate(
        id,
        { $inc: { votes: n } },
        { new: true, projection: { name: 1, votes: 1 } }
      ).lean();
    }
    if (!updated) {
      updated = await Artist.findOneAndUpdate(
        { _id: id },
        { $inc: { votes: n } },
        { new: true, projection: { name: 1, votes: 1 } }
      ).lean();
    }

    if (!updated) return res.status(404).json({ error: 'Artist not found' });

    res.status(200).json({
      id: String(updated._id),
      name: updated.name,
      votes: updated.votes || 0,
      ok: true,
    });
  } catch {
    res.status(500).json({ error: 'Failed to update vote' });
  }
});

module.exports = router;