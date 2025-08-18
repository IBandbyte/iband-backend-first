const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const CommentSchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Comment = mongoose.models.Comment || mongoose.model('Comment', CommentSchema);

// add comment
router.post('/', async (req, res) => {
  try {
    const { artistId, text } = req.body;
    const comment = await Comment.create({ artistId, text });
    res.status(201).json(comment);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// get comments for an artist
router.get('/:artistId', async (req, res) => {
  const items = await Comment.find({ artistId: req.params.artistId }).sort({ createdAt: -1 });
  res.json(items);
});

module.exports = router;