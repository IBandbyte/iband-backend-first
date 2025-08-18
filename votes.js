const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const VoteSchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, unique: true },
  count: { type: Number, default: 0 }
});
const Vote = mongoose.models.Vote || mongoose.model('Vote', VoteSchema);

// get current count
router.get('/:artistId', async (req, res) => {
  const v = await Vote.findOne({ artistId: req.params.artistId });
  res.json({ artistId: req.params.artistId, count: v ? v.count : 0 });
});

// increment
router.post('/:artistId', async (req, res) => {
  const v = await Vote.findOneAndUpdate(
    { artistId: req.params.artistId },
    { $inc: { count: 1 } },
    { new: true, upsert: true }
  );
  res.json(v);
});

module.exports = router;