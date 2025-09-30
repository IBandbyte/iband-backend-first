// routes/artists.fake.js — Fake artists for tests/seed
const express = require('express');
const router = express.Router();

// Simple in-memory fake dataset
let fakeArtists = [
  {
    _id: 'A',
    name: 'Test Artist A',
    genre: 'Pop',
    bio: 'A sample test artist',
    avatarUrl: '',
    votes: 0,
    comments: [],
  },
  {
    _id: 'B',
    name: 'Test Artist B',
    genre: 'Rock',
    bio: 'Another sample test artist',
    avatarUrl: '',
    votes: 0,
    comments: [],
  },
];

// GET all fake artists
router.get('/', (_req, res) => {
  res.json(fakeArtists);
});

// GET fake artist by id
router.get('/:id', (req, res) => {
  const a = fakeArtists.find((x) => x._id === req.params.id);
  if (!a) return res.status(404).json({ error: 'Artist not found' });
  res.json(a);
});

module.exports = router;