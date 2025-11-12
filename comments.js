/* eslint-env node */

const express = require('express');
const mongoose = require('mongoose');
const { isObjectIdLike } = require('./src/utils/isObjectId');

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

const Comment =
  mongoose.models.Comment ||
  mongoose.model(
    'Comment',
    new mongoose.Schema(
      {
        artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
        user: { type: String, required: true, trim: true },
        text: { type: String, required: true, trim: true, maxlength: 1000 },
      },
      { timestamps: true, collection: 'comments' }
    )
  );

function bad(res, status, msg) {
  return res.status(status).json({ ok: false, error: msg });
}

// GET /comments  (?artistId= OR ?artist=Name)
router.get('/', async (req, res) => {
  try {
    const q = {};
    if (req.query.artistId) {
      if (!isObjectIdLike(req.query.artistId)) return bad(res, 400, 'Invalid artistId');
      q.artistId = req.query.artistId;
    } else if (req.query.artist) {
      const found = await Artist.findOne({ name: req.query.artist }).select('_id');
      if (!found) return res.json([]); // no such artist
      q.artistId = found._id;
    }
    const list = await Comment.find(q).sort({ createdAt: -1 }).limit(200);
    return res.json(list);
  } catch (_e) {
    return bad(res, 500, 'Failed to fetch comments');
  }
});

// POST /comments  { artistId, user, text }
router.post('/', async (req, res) => {
  try {
    const { artistId, user, text } = req.body || {};
    if (!isObjectIdLike(artistId)) return bad(res, 400, 'artistId (ObjectId) is required');
    if (!user || !String(user).trim()) return bad(res, 400, 'user is required');
    if (!text || !String(text).trim()) return bad(res, 400, 'text is required');

    const artist = await Artist.findById(artistId).select('_id name');
    if (!artist) return bad(res, 404, 'Artist not found');

    const comment = await Comment.create({
      artistId: artist._id,
      user: String(user).trim(),
      text: String(text).trim(),
    });

    await Artist.updateOne({ _id: artist._id }, { $inc: { commentsCount: 1 } });

    return res.status(201).json({
      ok: true,
      id: comment._id,
      artistId: artist._id,
      artistName: artist.name,
      user: comment.user,
      text: comment.text,
      createdAt: comment.createdAt,
    });
  } catch (_e) {
    return bad(res, 500, 'Failed to add comment');
  }
});

// GET /comments/counts — per-artist counts (quick admin tool)
router.get('/counts', async (_req, res) => {
  try {
    const agg = await Comment.aggregate([
      { $group: { _id: '$artistId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    return res.json(agg);
  } catch (_e) {
    return bad(res, 500, 'Failed to get counts');
  }
});

module.exports = router;