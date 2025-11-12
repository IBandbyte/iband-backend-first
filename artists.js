// src/artists.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const ArtistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    genre: { type: String, default: '' },
    bio: { type: String, default: '' },
    image: { type: String, default: '' },
    votes: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

const Artist = mongoose.model('Artist', ArtistSchema);

// GET /artists -> list
router.get('/', async (_req, res) => {
  try {
    const artists = await Artist.find().sort({ createdAt: -1 }).lean();
    res.json(artists);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch artists' });
  }
});

// GET /artists/:id -> single
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid artist id' });
    }
    const artist = await Artist.findById(id).lean();
    if (!artist) return res.status(404).json({ error: 'Artist not found' });
    res.json(artist);
  } catch {
    res.status(500).json({ error: 'Failed to fetch artist' });
  }
});

// POST /artists -> create
router.post('/', async (req, res) => {
  try {
    const { name, genre = '', bio = '', image = '', votes = 0 } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const doc = await Artist.create({
      name: name.trim(),
      genre,
      bio,
      image,
      votes: Number.isFinite(votes) ? Math.max(0, Math.trunc(votes)) : 0
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create artist' });
  }
});

// POST /artists/:id/vote -> add/subtract votes
router.post('/:id/vote', async (req, res) => {
  try {
    const { id } = req.params;
    const { delta = 1 } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid artist id' });
    }
    const updated = await Artist.findByIdAndUpdate(
      id,
      { $inc: { votes: Math.trunc(Number(delta) || 0) } },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: 'Artist not found' });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to update votes' });
  }
});

module.exports = { router, Artist };