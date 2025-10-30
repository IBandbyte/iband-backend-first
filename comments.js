/* eslint-env node */

// comments.js — iBandbyte comments API (root-level)
// - POST /comments        -> create a comment  { artistId, user, text }
// - GET  /comments        -> list comments (optional ?artistId= or ?artist=Name)
// - GET  /comments/counts -> comment counts per artist (lightweight)

const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

/* ----------------------------------------
 * Minimal Artist model (only what we need)
 * -------------------------------------- */
const Artist =
  mongoose.models.Artist ||
  mongoose.model(
    'Artist',
    new mongoose.Schema(
      {
        name: String,
        genre: String,
        votes: { type: Number, default: 0 },
        commentsCount: { type: Number, default: 0 }, // denormalized counter
      },
      { collection: 'artists' } // use existing collection
    )
  );

/* ----------------------------------------
 * Comment model
 * -------------------------------------- */
const Comment =
  mongoose.models.Comment ||
  mongoose.model(
    'Comment',
    new mongoose.Schema(
      {
        artistId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Artist',
          required: true,
        },
        user: { type: String, required: true, trim: true },
        text: { type: String, required: true, trim: true, maxlength: 1000 },
      },
      { timestamps: true, collection: 'comments' }
    )
  );

/* ----------------------------------------
 * Helpers
 * -------------------------------------- */
function bad(res, status, msg) {
  return res.status(status).json({ ok: false, error: msg });
}

/* ----------------------------------------
 * GET /comments
 *  - optional filters:
 *      ?artistId=68be...   OR   ?artist=Aria%20Nova
 * -------------------------------------- */
router.get('/', async (req, res) => {
  try {
    const q = {};
    if (req.query.artistId) {
      if (!mongoose.isValidObjectId(req.query.artistId)) {
        return bad(res, 400, 'Invalid artistId');
      }
      q.artistId = req.query.artistId;
    }
    if (req.query.artist) {
      const found = await Artist.findOne({ name: req.query.artist }).select('_id');
      if (!found) return res.json([]); // no artist -> empty list
      q.artistId = found._id;
    }

    const list = await Comment.find(q).sort({ createdAt: -1 }).limit(200);
    return res.json(list);
  } catch (err) {
    return bad(res, 500, 'Failed to fetch comments');
  }
});

/* ----------------------------------------
 * POST /comments
 * Body: { artistId, user, text }
 * -------------------------------------- */
router.post('/', async (req, res) => {
  try {
    const { artistId, user, text } = req.body || {};

    if (!artistId || !mongoose.isValidObjectId(artistId)) {
      return bad(res, 400, 'artistId (ObjectId) is required');
    }
    if (!user || typeof user !== 'string' || !user.trim()) {
      return bad(res, 400, 'user is required');
    }
    if (!text || typeof text !== 'string' || !text.trim()) {
      return bad(res, 400, 'text is required');
    }

    // ensure artist exists
    const artist = await Artist.findById(artistId).select('_id name');
    if (!artist) return bad(res, 404, 'Artist not found');

    // create comment
    const comment = await Comment.create({
      artistId: artist._id,
      user: user.trim(),
      text: text.trim(),
    });

    // bump denormalized counter
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
  } catch (err) {
    return bad(res, 500, 'Failed to add comment');
  }
});

/* ----------------------------------------
 * GET /comments/counts
 * quick counts per artist (useful for admin/tools)
 * -------------------------------------- */
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