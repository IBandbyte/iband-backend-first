const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const ArtistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  genre: String,
  createdAt: { type: Date, default: Date.now }
});
const Artist = mongoose.models.Artist || mongoose.model('Artist', ArtistSchema);

// create
router.post('/', async (req, res) => {
  try {
    const artist = await Artist.create({ name: req.body.name, genre: req.body.genre });
    res.status(201).json(artist);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// list
router.get('/', async (_req, res) => {
  const artists = await Artist.find().sort({ createdAt: -1 });
  res.json(artists);
});

// get one
router.get('/:id', async (req, res) => {
  try {
    const item = await Artist.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch { res.status(400).json({ error: 'Invalid id' }); }
});

// delete
router.delete('/:id', async (req, res) => {
  try {
    const del = await Artist.findByIdAndDelete(req.params.id);
    if (!del) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch { res.status(400).json({ error: 'Invalid id' }); }
});

module.exports = router;