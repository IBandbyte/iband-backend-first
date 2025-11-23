// src/artistRoutes.js
// iBand - Artist routes (mounted at /artists in server.js)

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Artist = require('../models/artistModel'); // uses root/models

// Helper for validating Mongo IDs
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// ---------------------------------------------------------
// GET /artists
// List all artists (basic listing, future-proof)
// ---------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const artists = await Artist.find({})
      .sort({ createdAt: -1 })
      .lean();

    return res.json(artists);
  } catch (err) {
    console.error('Error fetching artists:', err);
    return res.status(500).json({ error: 'Server error fetching artists' });
  }
});

// ---------------------------------------------------------
// GET /artists/:id
// Get a single artist by ID
// ---------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid artist ID' });
    }

    const artist = await Artist.findById(id).lean();

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    return res.json(artist);
  } catch (err) {
    console.error('Error fetching artist:', err);
    return res.status(500).json({ error: 'Server error fetching artist' });
  }
});

// ---------------------------------------------------------
// POST /artists
// Create a new artist (basic fields, flexible schema)
// ---------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    const {
      name,
      genre,
      bio,
      imageUrl,
      socialLinks,
      isActive = true,
    } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Artist name is required' });
    }

    const artist = new Artist({
      name: name.trim(),
      genre,
      bio,
      imageUrl,
      socialLinks,
      isActive,
    });

    await artist.save();

    return res.status(201).json(artist);
  } catch (err) {
    console.error('Error creating artist:', err);
    return res.status(500).json({ error: 'Server error creating artist' });
  }
});

// ---------------------------------------------------------
// PATCH /artists/:id
// Update an artist (partial update)
// ---------------------------------------------------------
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid artist ID' });
    }

    const updates = req.body || {};

    const updated = await Artist.findByIdAndUpdate(id, updates, {
      new: true,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    return res.json(updated);
  } catch (err) {
    console.error('Error updating artist:', err);
    return res.status(500).json({ error: 'Server error updating artist' });
  }
});

// ---------------------------------------------------------
// DELETE /artists/:id
// Soft delete or hard delete (we mark isDeleted if field exists)
// ---------------------------------------------------------
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid artist ID' });
    }

    // Try soft delete: set isDeleted if schema supports it
    const updated = await Artist.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );

    if (updated) {
      return res.json(updated);
    }

    // Fallback: hard delete
    const deleted = await Artist.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Error deleting artist:', err);
    return res.status(500).json({ error: 'Server error deleting artist' });
  }
});

module.exports = router;