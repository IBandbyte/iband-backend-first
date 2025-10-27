/* eslint-env node */
/* global Buffer */

// comments.js — comments API (root-level)
// Stores comments linked to artistId and artistName (works with artists collection)

const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

// Schema (reuse if already registered)
const CommentSchema =
  mongoose.models.Comment?.schema ||
  new mongoose.Schema(
    {
      artistId: { type: String, required: true, trim: true }, // store as string to support string or ObjectId
      artistName: { type: String, required: true, trim: true },
      text: { type: String, required: true, trim: true },
      createdAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
  );

const Comment = mongoose.models.Comment || mongoose.model('Comment', CommentSchema);

/** Safe string helper */
const safeStr = (v = '') => (v ?? '').toString().trim();

/**
 * GET /comments
 * Optional query:
 *   - ?artistId=<id>   // filter by artistId
 *   - ?artist=<name>   // filter by artistName
 * Returns up to 200 newest comments (descending).
 */
router.get('/', async (req, res) => {
  try {
    const q = {};
    if (req.query.artistId) q.artistId = safeStr(req.query.artistId);
    if (req.query.artist) q.artistName = safeStr(req.query.artist);

    const list = await Comment.find(q).sort({ createdAt: -1 }).limit(200).lean().exec();
    res.status(200).json(list);
  } catch (err) {
    console.error('GET /comments error:', err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

/**
 * POST /comments
 * Body: { artistId, artistName, text }
 * Creates a comment and returns it (201).
 */
router.post('/', async (req, res) => {
  try {
    const artistId = safeStr(req.body?.artistId || req.body?.id || '');
    const artistName = safeStr(req.body?.artistName || req.body?.artist || '');
    const text = safeStr(req.body?.text || '');

    if (!artistId || !artistName || !text) {
      return res.status(400).json({ error: 'artistId, artistName and text are required' });
    }

    const c = await Comment.create({ artistId, artistName, text });
    res.status(201).json({
      id: c._id.toString(),
      artistId: c.artistId,
      artistName: c.artistName,
      text: c.text,
      createdAt: c.createdAt,
    });
  } catch (err) {
    console.error('POST /comments error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

module.exports = router;