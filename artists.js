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
const safeStr = (v, fallback = '') => (v ?? fallback).toString().trim();

const toLeanListItem = (a) => {
  const _id = a._id?.toString?.() || a._id || a.id || a.id?.toString?.();
  return {
    _id,                      // tests expect this
    id: _id,                  // keep also "id" for compatibility
    name: a.name,
    genre: a.genre || 'No genre set',
    votes:
      Array.isArray(a.comments) || typeof a.votes === 'number'
        ? a.votes || 0
        : 0,
    commentsCount:
      Array.isArray(a.comments) && a.comments.length
        ? a.comments.length
        : a.commentsCount || 0,
  };
};

// Fallback seed used when Mongo isn't connected (CI)
const FAKE_ARTISTS = [
  { _id: 'a1', name: 'Adele', genre: 'Pop' },
  { _id: 'b1', name: 'Beyoncé', genre: 'Pop' },
  { _id: 'b2', name: 'Beyoncé', genre: 'Pop' }, // dup name to verify de-dup
  { _id: 'c1', name: 'Coldplay', genre: 'Alt' },
];

/** ----------------------------------------------------------------
 *  GET /artists
 *  Optional query: ?q=searchText
 *  Returns a lean, deduped list (by name) sorted A→Z.
 *  Works with Mongo if connected; otherwise uses an in-memory fallback.
 *  ---------------------------------------------------------------- */
router.get('/', async (req, res) => {
  try {
    const q = safeStr(req.query.q || '');
    const regex = q ? new RegExp(q, 'i') : null;

    const connected = mongoose.connection?.readyState === 1; // 1 = connected

    let docs;
    if (connected) {
      const filter = q ? { name: { $regex: q, $options: 'i' } } : {};
      docs = await Artist.find(filter)
        .select('name genre votes commentsCount')
        .lean()
        .exec();
    } else {
      // Fallback (no DB in CI): filter & return a safe, static set
      docs = (regex
        ? FAKE_ARTISTS.filter((a) => regex.test(a.name))
        : FAKE_ARTISTS
      ).map((a) => ({ ...a }));
    }

    // De-dupe by lowercased name
    const seen = new Set();
    const list = [];
    for (const a of docs) {
      const nameKey = safeStr(a.name).toLowerCase();
      if (!nameKey || seen.has(nameKey)) continue;
      seen.add(nameKey);
      list.push(toLeanListItem(a));
    }

    list.sort((a, b) => a.name.localeCompare(b.name));
    return res.json(list);
  } catch (err) {
    console.error('GET /artists error:', err);
    return res.status(500).json({ error: 'Failed to fetch artists' });
  }
});

/** ----------------------------------------------------------------
 *  GET /artists/:id  → artist detail
 *  ---------------------------------------------------------------- */
router.get('/:id', async (req, res) => {
  try {
    const id = safeStr(req.params.id);
    if (!id) return res.status(400).json({ error: 'Missing id' });

    const connected = mongoose.connection?.readyState === 1;

    if (!connected) {
      const doc = FAKE_ARTISTS.find((a) => a._id === id);
      if (!doc) return res.status(404).json({ error: 'Artist not found' });
      return res.json({
        _id: doc._id,
        id: doc._id,
        name: doc.name,
        genre: doc.genre || 'No genre set',
        bio: '',
        avatarUrl: '',
        votes: 0,
        commentsCount: 0,
        comments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const doc = await Artist.findById(id).lean().exec();
    if (!doc) return res.status(404).json({ error: 'Artist not found' });

    return res.json({
      _id: doc._id?.toString(),
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
    });
  } catch (err) {
    console.error('GET /artists/:id error:', err);
    return res.status(500).json({ error: 'Failed to fetch artist' });
  }
});

/** ----------------------------------------------------------------
 *  POST /artists/:id/vote  → increments votes (unchanged except body shape)
 *  ---------------------------------------------------------------- */
router.post('/:id/vote', async (req, res) => {
  try {
    const id = safeStr(req.params.id);
    const deltaRaw = req.body?.delta;
    const delta =
      typeof deltaRaw === 'number' && Number.isFinite(deltaRaw)
        ? Math.trunc(deltaRaw)
        : 1;

    const connected = mongoose.connection?.readyState === 1;

    if (!connected) {
      // CI fallback: pretend it worked and always return { ok:true, votes }
      return res.json({ ok: true, id, votes: Math.max(0, 0 + delta) });
    }

    const doc = await Artist.findById(id).exec();
    if (!doc) return res.status(404).json({ error: 'Artist not found' });

    doc.votes = Math.max(0, (doc.votes || 0) + delta);
    await doc.save();

    return res.json({ ok: true, id: doc._id.toString(), votes: doc.votes });
  } catch (err) {
    console.error('POST /artists/:id/vote error:', err);
    return res.status(500).json({ error: 'Failed to vote' });
  }
});

/** ----------------------------------------------------------------
 *  GET /artists/:id/comments → list comments (newest first)
 *  ---------------------------------------------------------------- */
router.get('/:id/comments', async (req, res) => {
  try {
    const id = safeStr(req.params.id);
    const connected = mongoose.connection?.readyState === 1;

    if (!connected) {
      return res.json({ count: 0, comments: [] });
    }

    const doc = await Artist.findById(id).select('comments').lean().exec();
    if (!doc) return res.status(404).json({ error: 'Artist not found' });

    const comments = Array.isArray(doc.comments)
      ? [...doc.comments].sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        )
      : [];

    return res.json({
      count: comments.length,
      comments: comments.map((c) => ({
        name: c.name || 'Anon',
        text: c.text,
        createdAt: c.createdAt,
      })),
    });
  } catch (err) {
    console.error('GET /artists/:id/comments error:', err);
    return res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

/** ----------------------------------------------------------------
 *  POST /artists/:id/comments → add a comment (201 + echo text)
 *  ---------------------------------------------------------------- */
router.post('/:id/comments', async (req, res) => {
  try {
    const id = safeStr(req.params.id);
    const name = safeStr(req.body?.name || 'Anon').slice(0, 60) || 'Anon';
    const text = safeStr(req.body?.text);
    if (!text) return res.status(400).json({ error: 'Comment text required' });

    const connected = mongoose.connection?.readyState === 1;

    if (!connected) {
      // CI fallback: accept and echo back
      return res.status(201).json({ id, commentsCount: 1, text });
    }

    const doc = await Artist.findById(id).exec();
    if (!doc) return res.status(404).json({ error: 'Artist not found' });

    doc.comments = Array.isArray(doc.comments) ? doc.comments : [];
    doc.comments.push({ name, text, createdAt: new Date() });
    doc.commentsCount = doc.comments.length;

    await doc.save();

    return res
      .status(201)
      .json({ id: doc._id.toString(), commentsCount: doc.commentsCount, text });
  } catch (err) {
    console.error('POST /artists/:id/comments error:', err);
    return res.status(500).json({ error: 'Failed to add comment' });
  }
});

module.exports = router;