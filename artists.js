// artists.js — Artists API (list, detail, update, vote, comments)
const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

/* ------------------------------------------------------------------ *
 * Model (reuse if already registered; define if not)
 * ------------------------------------------------------------------ */
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
    },
    { timestamps: true }
  );

const Artist = mongoose.models.Artist || mongoose.model('Artist', ArtistSchema);

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */
const safeStr = (v, fallback = '') => (v ?? fallback).toString().trim();
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Find one by either real ObjectId or string-stored _id
const findOneByIdFlexible = async (id, select) => {
  if (isValidObjectId(id)) {
    const doc = await Artist.findById(id).select(select).exec();
    if (doc) return doc;
  }
  return Artist.findOne({ _id: id }).select(select).exec();
};

// Same but lean()
const findOneByIdFlexibleLean = async (id, select) => {
  if (isValidObjectId(id)) {
    const doc = await Artist.findById(id).select(select).lean().exec();
    if (doc) return doc;
  }
  return Artist.findOne({ _id: id }).select(select).lean().exec();
};

const toLeanListItem = (a) => ({
  _id: a._id?.toString(),
  name: a.name,
  genre: a.genre || 'No genre set',
  votes: typeof a.votes === 'number' ? a.votes : 0,
  commentsCount:
    Array.isArray(a.comments) && a.comments.length
      ? a.comments.length
      : a.commentsCount || 0,
});

/* ------------------------------------------------------------------ *
 * GET /artists  → list (deduped by name, A→Z)
 * ------------------------------------------------------------------ */
router.get('/', async (_req, res) => {
  try {
    const docs = await Artist.find({})
      .select('name genre votes commentsCount comments')
      .lean()
      .exec();

    const seen = new Set();
    const list = [];
    for (const a of docs) {
      const key = safeStr(a.name).toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      list.push(toLeanListItem(a));
    }

    list.sort((a, b) => a.name.localeCompare(b.name));
    res.status(200).json(list);
  } catch (err) {
    console.error('GET /artists error:', err);
    res.status(500).json({ error: 'Failed to fetch artists' });
  }
});

/* ------------------------------------------------------------------ *
 * GET /artists/:id  → artist detail (robust id handling)
 * ------------------------------------------------------------------ */
router.get('/:id', async (req, res) => {
  const id = safeStr(req.params.id);
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    const doc = await findOneByIdFlexibleLean(id);
    if (!doc) return res.status(404).json({ error: 'Artist not found' });

    const out = {
      id: doc._id?.toString(),
      name: doc.name,
      genre: doc.genre || 'No genre set',
      bio: doc.bio || '',
      avatarUrl: doc.avatarUrl || '',
      votes: typeof doc.votes === 'number' ? doc.votes : 0,
      commentsCount:
        Array.isArray(doc.comments) && doc.comments.length
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
    };

    res.status(200).json(out);
  } catch (err) {
    console.error('GET /artists/:id error:', err?.message || err);
    res.status(500).json({ error: 'Failed to fetch artist' });
  }
});

/* ------------------------------------------------------------------ *
 * PATCH /artists/:id  → update limited fields (name, genre, bio, avatarUrl)
 * Body: JSON with any of { name, genre, bio, avatarUrl }
 * ------------------------------------------------------------------ */
router.patch('/:id', async (req, res) => {
  const id = safeStr(req.params.id);

  // Collect only allowed fields
  const updates = {};
  const maybe = (key) => {
    if (typeof req.body?.[key] === 'string') {
      const v = safeStr(req.body[key]);
      if (v.length) updates[key] = v;
    }
  };
  maybe('name');
  maybe('genre');
  maybe('bio');
  maybe('avatarUrl');

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }
  updates.updatedAt = new Date();

  try {
    // Build a flexible filter for either ObjectId or string _id
    const filter = isValidObjectId(id)
      ? { _id: new mongoose.Types.ObjectId(id) }
      : { _id: id };

    const doc = await Artist.findOneAndUpdate(filter, updates, {
      new: true,
      runValidators: true,
      lean: true,
    }).exec();

    if (!doc) return res.status(404).json({ error: 'Artist not found' });

    res.status(200).json({
      id: doc._id?.toString(),
      name: doc.name,
      genre: doc.genre,
      bio: doc.bio,
      avatarUrl: doc.avatarUrl,
      votes: doc.votes || 0,
      commentsCount: doc.commentsCount || (doc.comments?.length || 0),
      updatedAt: doc.updatedAt,
    });
  } catch (err) {
    console.error('PATCH /artists/:id error:', err?.message || err);
    res.status(500).json({ error: 'Failed to update artist' });
  }
});

/* ------------------------------------------------------------------ *
 * POST /artists/:id/vote  → increments votes (default +1)
 * Body: { delta?: number }
 * ------------------------------------------------------------------ */
router.post('/:id/vote', async (req, res) => {
  try {
    const id = safeStr(req.params.id);
    const deltaRaw = req.body?.delta;
    const delta =
      typeof deltaRaw === 'number' && Number.isFinite(deltaRaw)
        ? Math.trunc(deltaRaw)
        : 1;

    const doc = await findOneByIdFlexible(id);
    if (!doc) return res.status(404).json({ error: 'Artist not found' });

    doc.votes = Math.max(0, (doc.votes || 0) + delta);
    await doc.save();

    res.status(200).json({ ok: true, votes: doc.votes });
  } catch (err) {
    console.error('POST /artists/:id/vote error:', err);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

/* ------------------------------------------------------------------ *
 * GET /artists/:id/comments → list comments (newest first)
 * NOTE: returns an ARRAY (per tests)
 * ------------------------------------------------------------------ */
router.get('/:id/comments', async (req, res) => {
  try {
    const id = safeStr(req.params.id);
    const doc = await findOneByIdFlexibleLean(id, 'comments');
    if (!doc) return res.status(404).json({ error: 'Artist not found' });

    const comments = Array.isArray(doc.comments)
      ? [...doc.comments]
          .map((c) => ({
            name: c.name || 'Anon',
            text: c.text,
            createdAt: c.createdAt,
          }))
          .sort(
            (a, b) =>
              new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
          )
      : [];

    res.status(200).json(comments);
  } catch (err) {
    console.error('GET /artists/:id/comments error:', err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

/* ------------------------------------------------------------------ *
 * POST /artists/:id/comments → add a comment
 * Body: { name?: string, text: string }
 * ------------------------------------------------------------------ */
router.post('/:id/comments', async (req, res) => {
  try {
    const id = safeStr(req.params.id);
    const name = safeStr(req.body?.name || 'Anon').slice(0, 60) || 'Anon';
    const text = safeStr(req.body?.text);
    if (!text) return res.status(400).json({ error: 'Comment text required' });

    const doc = await findOneByIdFlexible(id);
    if (!doc) return res.status(404).json({ error: 'Artist not found' });

    doc.comments = Array.isArray(doc.comments) ? doc.comments : [];
    const newComment = { name, text, createdAt: new Date() };
    doc.comments.push(newComment);
    doc.commentsCount = doc.comments.length;
    await doc.save();

    res.status(201).json({
      id: doc._id.toString(),
      name: newComment.name,
      text: newComment.text,
      createdAt: newComment.createdAt,
      commentsCount: doc.commentsCount,
    });
  } catch (err) {
    console.error('POST /artists/:id/comments error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

module.exports = router;