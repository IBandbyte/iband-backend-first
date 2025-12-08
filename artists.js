// artists.js
// Public artist routes (no admin key required)

const express = require('express');
const ArtistsStore = require('./artistsStore');

const router = express.Router();

/**
 * GET /api/artists
 * List all artists (public)
 */
router.get('/', (req, res) => {
  try {
    const artists = ArtistsStore.getAll();
    res.json({
      success: true,
      count: artists.length,
      artists,
    });
  } catch (err) {
    console.error('Error listing artists:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
});

/**
 * GET /api/artists/:id
 * Get one artist by ID (public)
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const artist = ArtistsStore.getById(id);

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: 'Artist not found.',
        id,
      });
    }

    res.json({
      success: true,
      artist,
    });
  } catch (err) {
    console.error('Error fetching artist by id:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
});

module.exports = router;