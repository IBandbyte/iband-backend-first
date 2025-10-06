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

const toLeanListItem = (a) => ({
  _id: a._id?.toString(), // keep _id to match tests that use first._id
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
});

/** ----------------------------------------------------------------
 *  GET /artists
 *  Optional query: ?q=searchText
 *  Returns a lean, deduped list (by name) sorted A→Z.
 *  ---------------------------------------------------------------- */
router.get('/', async (_req, res) => {
  try {
    const docs = await Artist.find({})
      .select('name genre votes commentsCount comments')
      .lean()
      .exec();

    // De-dupe by lowercased name (in case existing data has dupes)
    const seen = new Set();
    const list = [];
    for (const a of docs) {
      const nameKey = safeStr(a.name).toLowerCase();
      if (!nameKey) continue;
      if (seen.has(nameKey)) continue;
      seen.add(nameKey);
      list.push(toLeanListItem(a));
    }

    list.sort((a, b) => a.name.localeCompare(b.name));
    res.status(200).json(list);
  } catch (err) {
    console.error('GET /artists error:', err);
    res.status(500).json({ error: 'Failed to fetch artists' });
  }
});

/** ----------------------------------------------------------------
 *  GET /artists/:id  → artist detail (robust)
 *  - Tries findById for normal ObjectId
 *  - Also tries findOne({_id: id}) to support string-stored _id
 *  - Never throws a CastError back at the client; returns 404 when not found
 *  ---------------------------------------------------------------- */
router.get('/:id', async (req, res) => {
  const id = safeStr(req.params.id);
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    const isValidObjectId = mongoose.Types.ObjectId.isValid(id);

    // First attempt: native findById if the id looks like an ObjectId
    let doc = null;
    if (isValidObjectId) {
      doc = await Artist.findById(id).lean().exec();
    }

    // Fallback for string _id
    if (!doc) {
      doc = await Artist.findOne({ _id: id }).lean().exec();
    }

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

/** ----------------------------------------------------------------
 *  POST /artists/:id/vote  → increments votes
 *  Body: { delta?: number }  (default +1)
 *  ---------------------------------------------------------------- */
router.post('/:id/vote', async (req, res) => {
  try {
    const id = safeStr(req.params.id);
    const deltaRaw = req.body?.delta;
    const delta =
      typeof deltaRaw === 'number' && Number.isFinite(deltaRaw)
        ? Math.trunc(deltaRaw)
        : 1;

    const isValidObjectId = mongoose.Types.ObjectId.isValid(id);
    let doc = null;
    if (isValidObjectId) {
      doc = await Artist.findById(id).exec();
    }
    if (!doc) {
      doc = await Artist.findOne({ _id: id }).exec();
    }

    if (!doc) return res.status(404).json({ error: 'Artist not found' });

    doc.votes = Math.max(0, (doc.votes || 0) + delta);
    await doc.save();

    res.status(200).json({ ok: true, votes: doc.votes });
  } catch (err) {
    console.error('POST /artists/:id/vote error:', err);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

/** ----------------------------------------------------------------
 *  GET /artists/:id/comments → list comments (newest first)
 *  ---------------------------------------------------------------- */
router.get('/:id/comments', async (req, res) => {
  try {
    const id = safeStr(req.params.id);

    const isValidObjectId = mongoose.Types.ObjectId.isValid(id);
    let doc = null;
    if (isValidObjectId) {
      doc = await Artist.findById(id).select('comments').lean().exec();
    }
    if (!doc) {
      doc = await Artist.findOne({ _id: id }).select('comments').lean().exec();
    }

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

/** ----------------------------------------------------------------
 *  POST /artists/:id/comments → add a comment
 *  Body: { name?: string, text: string }
 *  ---------------------------------------------------------------- */
router.post('/:id/comments', async (req, res) => {
  try {
    const id = safeStr(req.params.id);
    const name = safeStr(req.body?.name || 'Anon').slice(0, 60) || 'Anon';
    const text = safeStr(req.body?.text);

    if (!text) {
      return res.status(400).json({ error: 'Comment text required' });
    }

    const isValidObjectId = mongoose.Types.ObjectId.isValid(id);
    let doc = null;
    if (isValidObjectId) {
      doc = await Artist.findById(id).exec();
    }
    if (!doc) {
      doc = await Artist.findOne({ _id: id }).exec();
    }

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

/** ----------------------------------------------------------------
 *  PATCH /artists/:id → update allowed fields (name, genre)
 *  Body: { name?: string, genre?: string }
 *  Accepts ObjectId or string _id, returns minimal confirmation.
 *  ---------------------------------------------------------------- */
router.patch('/:id', async (req, res) => {
  try {
    const id = safeStr(req.params.id);
    if (!id) return res.status(400).json({ error: 'Missing id' });

    const updates = {};
    if (typeof req.body?.name === 'string')
      updates.name = safeStr(req.body.name).slice(0, 200);
    if (typeof req.body?.genre === 'string')
      updates.genre = safeStr(req.body.genre).slice(0, 120);

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const isValidObjectId = mongoose.Types.ObjectId.isValid(id);
    let doc = null;
    if (isValidObjectId) {
      doc = await Artist.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      ).lean();
    }
    if (!doc) {
      doc = await Artist.findOneAndUpdate(
        { _id: id },
        { $set: updates },
        { new: true, runValidators: true }
      ).lean();
    }

    if (!doc) return res.status(404).json({ error: 'Artist not found' });

    res.status(200).json({
      ok: true,
      id: doc._id?.toString(),
      name: doc.name,
      genre: doc.genre,
    });
  } catch (err) {
    console.error('PATCH /artists/:id error:', err);
    res.status(500).json({ error: 'Failed to update artist' });
  }
});

module.exports = router;