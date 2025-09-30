// artists.fake.js — In-memory artist list (CI-safe, no DB)

const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');

// --- In-memory list ---
let fakeArtists = [
  { _id: 'A', name: 'Alpha Band', votes: 0, comments: [] },
  { _id: 'B', name: 'Beta Crew', votes: 0, comments: [] },
];

// GET /artists → list of artists (A→Z sorted, deduped)
router.get('/', (_req, res) => {
  try {
    const deduped = [];
    const seen = new Set();

    for (const a of fakeArtists) {
      if (!seen.has(a._id)) {
        seen.add(a._id);
        deduped.push(a);
      }
    }

    deduped.sort((a, b) => a.name.localeCompare(b.name));
    res.json(deduped);
  } catch (err) {
    console.error('GET /artists error:', err);
    res.status(500).json({ error: 'Failed to fetch artists' });
  }
});

// POST /artists/:id/vote → increment votes
router.post('/:id/vote', (req, res) => {
  try {
    const id = String(req.params.id);
    const artist = fakeArtists.find((a) => a._id === id);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    artist.votes = (artist.votes || 0) + 1;
    res.json({ ok: true, votes: artist.votes });
  } catch (err) {
    console.error('POST /artists/:id/vote error:', err);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

// POST /artists/:id/comments → add a comment
router.post('/:id/comments', (req, res) => {
  try {
    const id = String(req.params.id);
    const artist = fakeArtists.find((a) => a._id === id);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Missing comment text' });

    const comment = { id: randomUUID(), text };
    artist.comments.push(comment);

    res.status(201).json(comment);
  } catch (err) {
    console.error('POST /artists/:id/comments error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// GET /artists/:id/comments → list comments
router.get('/:id/comments', (req, res) => {
  try {
    const id = String(req.params.id);
    const artist = fakeArtists.find((a) => a._id === id);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    res.json(artist.comments);
  } catch (err) {
    console.error('GET /artists/:id/comments error:', err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

module.exports = router;