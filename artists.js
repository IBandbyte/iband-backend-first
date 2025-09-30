// artists.js — Artists API (list, detail, vote, comments)
const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

/** ----------------------------------------------------------------
 *  Model (reuse if already registered; define if not)
 *  ---------------------------------------------------------------- */
const ArtistSchema =
  mongoose.models.Artist?.schema ||
  new mongoose.Schema(
    {
      name: { type: String, required: true, trim: true },
      genre: { type: String, default: 'No genre set', trim: true },
      bio: { type: String, default: '', trim: true },
      avatarUrl: { type: String, default: '' },
      votes: { type: Number, default: 0 },
      commentsCount: { type: Number, default: 0 },
      comments: [
        {
          name: { type: String, default: 'Anon', trim: true },
          text: { type: String, required: true, trim: true },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
  );

const Artist =
  mongoose.models.Artist || mongoose.model('Artist', ArtistSchema);

/** Small helpers */
const safeStr = (v, fallback = '') =>
  (v ?? fallback).toString().trim();

const toLeanListItem = (a) => ({
  id: a._id?.toString(),
  name: a.name,
  genre: a.genre || 'No genre set',
  votes: typeof a.votes === 'number' ? a.votes : 0,
  commentsCount: Array.isArray(a.comments)
    ? a.comments.length
    : a.commentsCount || 0,
});

/** ----------------------------------------------------------------
 *  GET /artists
 *  ---------------------------------------------------------------- */
router.get('/', async (req, res) => {
  try {
    const q = safeStr(req.query.q || '');
    const filter = q
      ? { name: { $regex: q, $options: 'i' } }
      : {};

    const docs = await Artist.find(filter)
      .select('name genre votes commentsCount')
      .lean()
      .exec();

    const seen = new Set();
    const list = [];
    for (const a of docs) {
      const nameKey = safeStr(a.name).toLowerCase();
      if (!nameKey || seen.has(nameKey)) continue;
      seen.add(nameKey);
      list.push(toLeanListItem(a));
    }

    list.sort((a, b) => a.name.localeCompare(b.name));
    res.json(list);
  } catch (err) {
    console.error('GET /artists error:', err);
    res.status(500).json({ error: 'Failed to fetch artists' });
  }
});

/** ----------------------------------------------------------------
 *  GET /artists/:id
 *  ---------------------------------------------------------------- */
router.get('/:id', async (req, res) => {
  try {
    const id = safeStr(req.params.id);
    const doc = await Artist.findById(id).lean().exec();
    if (!doc) return res.status(404).json({ error: 'Artist not found' });

    res.json({
      id: doc._id?.toString(),
      name: doc.name,
      genre: doc.genre || 'No genre set',
      bio: doc.bio || '',
      avatarUrl: doc.avatarUrl || '',
      votes: typeof doc.votes === 'number' ? doc.votes : 0,
      commentsCount: Array.isArray(doc.comments)
        ? doc.comments.length
        : doc.commentsCount || 0,
      comments: Array.isArray(doc.comments)
        ? doc.comments.map((c) => ({
            name: c.name || 'Anon',
            text: c.text,
            createdAt: c.createdAt,
          }))
        : [],
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  } catch (err) {
    console.error('GET /artists/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch artist' });
  }
});

/** ----------------------------------------------------------------
 *  POST /artists/:id/vote
 *  ---------------------------------------------------------------- */
router.post('/:id/vote', async (req, res) => {
  try {
    const id = safeStr(req.params.id);
    const delta = Number.isFinite(req.body?.delta)
      ? Math.trunc(req.body.delta)
      : 1;

    const doc = await Artist.findById(id).exec();
    if (!doc) return res.status(404).json({ error: 'Artist not found' });

    doc.votes = Math.max(0, (doc.votes || 0) + delta);
    await doc.save();

    res.status(200).json({ ok: true, id: doc._id.toString(), votes: doc.votes });
  } catch (err) {
    console.error('POST /artists/:id/vote error:', err);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

/** ----------------------------------------------------------------
 *  GET /artists/:id/comments
 *  ---------------------------------------------------------------- */
router.get('/:id/comments', async (req, res) => {
  try {
    const id = safeStr(req.params.id);
    const doc = await Artist.findById(id).select('comments').lean().exec();
    if (!doc) return res.status(404).json({ error: 'Artist not found' });

    const comments = Array.isArray(doc.comments)
      ? [...doc.comments].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        )
      : [];

    res.json({
      count: comments.length,
      comments: comments.map((c) => ({
        name: c.name || 'Anon',
        text: c.text,
        createdAt: c.createdAt,
      })),
    });
  } catch (err) {
    console.error('GET /artists/:id/comments error:', err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

/** ----------------------------------------------------------------
 *  POST /artists/:id/comments
 *  ---------------------------------------------------------------- */
router.post('/:id/comments', async (req, res) => {
  try {
    const id = safeStr(req.params.id);
    const name = safeStr(req.body?.name || 'Anon').slice(0, 60) || 'Anon';
    const text = safeStr(req.body?.text);

    if (!text) {
      return res.status(400).json({ error: 'Comment text required' });
    }

    const doc = await Artist.findById(id).exec();
    if (!doc) return res.status(404).json({ error: 'Artist not found' });

    doc.comments = Array.isArray(doc.comments) ? doc.comments : [];
    const newComment = { name, text, createdAt: new Date() };
    doc.comments.push(newComment);
    doc.commentsCount = doc.comments.length;

    await doc.save();

    res.status(201).json(newComment);
  } catch (err) {
    console.error('POST /artists/:id/comments error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

module.exports = router;