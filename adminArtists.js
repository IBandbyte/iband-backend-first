// adminArtists.js
// Admin-only routes to inspect, create and update artists for iBand.
// Mounted from server.js at: /api/admin/artists

const express = require('express');
const router = express.Router();

// Shared in-memory artist store
const artistsStore = require('./artistsStore');

// Simple admin key protection
const ADMIN_KEY = process.env.ADMIN_KEY || 'mysecret123';

function requireAdminKey(req, res, next) {
  const key = req.header('x-admin-key');

  if (!key) {
    return res.status(401).json({
      success: false,
      message: 'Missing x-admin-key header.',
    });
  }

  if (key !== ADMIN_KEY) {
    return res.status(403).json({
      success: false,
      message: 'Invalid admin key.',
    });
  }

  return next();
}

// Utility: normalize an artist payload (used by create + update)
function buildArtistPayload(input) {
  const payload = {};

  if (typeof input.name === 'string') {
    payload.name = input.name.trim();
  }

  if (typeof input.genre === 'string') {
    payload.genre = input.genre.trim();
  }

  if (typeof input.bio === 'string') {
    payload.bio = input.bio.trim();
  }

  if (typeof input.imageUrl === 'string') {
    payload.imageUrl = input.imageUrl.trim();
  }

  return payload;
}

// GET /api/admin/artists
// List all artists (admin view, includes count)
router.get('/', requireAdminKey, (req, res) => {
  try {
    const artists = artistsStore.getAllArtists
      ? artistsStore.getAllArtists()
      : [];

    return res.json({
      success: true,
      count: artists.length,
      artists,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/artists:', error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
});

// POST /api/admin/artists/seed
// Create / seed a single artist (used via Hoppscotch)
router.post('/seed', requireAdminKey, (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Request body must be JSON.',
      });
    }

    const payload = buildArtistPayload(req.body);

    if (!payload.name) {
      return res.status(400).json({
        success: false,
        message: 'Artist "name" is required.',
      });
    }

    // Allow optional fields; the store should handle defaults.
    const artist = artistsStore.addArtist
      ? artistsStore.addArtist(payload)
      : null;

    if (!artist) {
      return res.status(500).json({
        success: false,
        message: 'Unable to create artist.',
      });
    }

    return res.status(201).json({
      success: true,
      artist,
    });
  } catch (error) {
    console.error('Error in POST /api/admin/artists/seed:', error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
});

// PUT /api/admin/artists/:id
// Update an existing artist (partial updates allowed)
router.put('/:id', requireAdminKey, (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Artist id is required in the URL.',
      });
    }

    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Request body must be JSON.',
      });
    }

    const artists = artistsStore.getAllArtists
      ? artistsStore.getAllArtists()
      : [];

    const artist = artists.find(
      (a) => String(a.id) === String(id),
    );

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: 'Artist not found.',
        id,
      });
    }

    const payload = buildArtistPayload(req.body);

    if (
      payload.name === undefined &&
      payload.genre === undefined &&
      payload.bio === undefined &&
      payload.imageUrl === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          'No updatable fields provided. You can send name, genre, bio or imageUrl.',
      });
    }

    // Apply partial updates
    if (payload.name !== undefined) {
      artist.name = payload.name;
    }

    if (payload.genre !== undefined) {
      artist.genre = payload.genre;
    }

    if (payload.bio !== undefined) {
      artist.bio = payload.bio;
    }

    if (payload.imageUrl !== undefined) {
      artist.imageUrl = payload.imageUrl;
    }

    // Since this is an in-memory store, mutating the artist object
    // updates the array inside artistsStore as well.

    return res.json({
      success: true,
      artist,
    });
  } catch (error) {
    console.error('Error in PUT /api/admin/artists/:id:', error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
});

module.exports = router;