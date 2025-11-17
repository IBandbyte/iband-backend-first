// backend/src/routes/artists.js
// iBand - Artists routes (full CRUD, future-proof)
// This router handles:
//   GET    /artists
//   GET    /artists/:id
//   POST   /artists
//   PUT    /artists/:id
//   PATCH  /artists/:id
//   DELETE /artists/:id

const express = require('express');
const mongoose = require('mongoose');

// NOTE: This assumes your Artist model file is:
//   backend/src/models/artistModel.js
// If your file is named differently (e.g. artist.js),
// keep the original require line from your old file.
const Artist = require('../models/artistModel');

const router = express.Router();

/**
 * Utility: build a clean update object from request body
 * so we don't accidentally allow unknown fields.
 */
function buildArtistUpdate(body) {
  const allowedFields = [
    'name',
    'genre',
    'bio',
    'imageUrl',
    'location',
    'country',
    'debutYear',
    'isFeatured',
    'isActive',
    'tags',
    'socialLinks',
    'externalLinks'
  ];

  const update = {};

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      update[field] = body[field];
    }
  }

  return update;
}

/**
 * GET /artists
 * Optional future filters could go here (genre, search, etc.)
 */
router.get('/', async (req, res) => {
  try {
    const artists = await Artist.find().sort({ createdAt: -1 });
    res.json(artists);
  } catch (err) {
    console.error('GET /artists error:', err);
    res.status(500).json({ message: 'Failed to fetch artists' });
  }
});

/**
 * GET /artists/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid artist id' });
    }

    const artist = await Artist.findById(id);

    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    res.json(artist);
  } catch (err) {
    console.error('GET /artists/:id error:', err);
    res.status(500).json({ message: 'Failed to fetch artist' });
  }
});

/**
 * POST /artists
 * Create a new artist
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      genre,
      bio,
      imageUrl,
      location,
      country,
      debutYear,
      isFeatured,
      isActive,
      tags,
      socialLinks,
      externalLinks
    } = req.body;

    if (!name || !genre) {
      return res.status(400).json({ message: 'Name and genre are required' });
    }

    const artist = new Artist({
      name,
      genre,
      bio: bio || '',
      imageUrl: imageUrl || null,
      location: location || null,
      country: country || null,
      debutYear: debutYear || null,
      isFeatured: typeof isFeatured === 'boolean' ? isFeatured : false,
      isActive: typeof isActive === 'boolean' ? isActive : true,
      tags: Array.isArray(tags) ? tags : [],
      socialLinks: socialLinks || {},
      externalLinks: externalLinks || {}
    });

    const saved = await artist.save();

    res.status(201).json(saved);
  } catch (err) {
    console.error('POST /artists error:', err);
    res.status(500).json({ message: 'Failed to create artist' });
  }
});

/**
 * PUT /artists/:id
 * Full-ish update (we still restrict to allowed fields).
 * If artist does not exist, return 404.
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid artist id' });
    }

    const update = buildArtistUpdate(req.body);

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided to update' });
    }

    const updated = await Artist.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true
    });

    if (!updated) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    res.json(updated);
  } catch (err) {
    console.error('PUT /artists/:id error:', err);
    res.status(500).json({ message: 'Failed to update artist' });
  }
});

/**
 * PATCH /artists/:id
 * Partial update (same as PUT but semantically "partial").
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid artist id' });
    }

    const update = buildArtistUpdate(req.body);

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided to update' });
    }

    const updated = await Artist.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true
    });

    if (!updated) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    res.json(updated);
  } catch (err) {
    console.error('PATCH /artists/:id error:', err);
    res.status(500).json({ message: 'Failed to update artist' });
  }
});

/**
 * DELETE /artists/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid artist id' });
    }

    const deleted = await Artist.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    res.json({ message: 'Artist deleted successfully' });
  } catch (err) {
    console.error('DELETE /artists/:id error:', err);
    res.status(500).json({ message: 'Failed to delete artist' });
  }
});

module.exports = router;