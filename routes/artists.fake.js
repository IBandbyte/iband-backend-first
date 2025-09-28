// routes/artists.fake.js
// Test-only in-memory Artists router that mirrors the real routes' shape.

const express = require('express');
const router = express.Router();

// Minimal seed with a duplicate to verify de-dupe/sort behavior in tests
const seed = [
  { _id: 'a1', name: 'Alpha', genre: 'Rock', votes: 0 },
  { _id: 'b1', name: 'Beta', genre: 'Pop', votes: 0 },
  { _id: 'a1', name: 'alpha', genre: 'Rock', votes: 0 }, // duplicate id/name (case diff)
];

const comments = new Map(); // id -> [{id, text, at}]

function normalizeName(s) {
  return (s || '').toString().trim();
}

function sanitizeAndDedupe(arr) {
  const valid = arr
    .filter((a) => typeof a?.name === 'string' && normalizeName(a.name).length > 0)
    .map((a) => ({
      _id: a._id,
      name: normalizeName(a.name),
      genre: normalizeName(a.genre) || 'No genre set',
      votes: typeof a.votes === 'number' ? a.votes : 0,
    }));

  const seen = new Set();
  const unique = [];
  for (const a of valid) {
    const key = (a._id || a.name).toString().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(a);
    }
  }
  unique.sort((a, b) => a.name.localeCompare(b.name));
  return unique;
}

let artists = sanitizeAndDedupe(seed);

// GET /artists → list
router.get('/', (_req, res) => {
  res.json(artists);
});

// GET /artists/:id → one
router.get('/:id', (req, res) => {
  const a = artists.find((x) => (x._id || '').toString() === req.params.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  res.json(a);
});

// POST /artists/:id/vote → +1 vote
router.post('/:id/vote', (req, res) => {
  const a = artists.find((x) => (x._id || '').toString() === req.params.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  a.votes = (a.votes || 0) + 1;
  res.json({ ok: true, id: a._id, votes: a.votes });
});

// GET /artists/:id/comments → list comments
router.get('/:id/comments', (req, res) => {
  const list = comments.get(req.params.id) || [];
  res.json(list);
});

// POST /artists/:id/comments → add comment
router.post('/:id/comments', (req, res) => {
  const text = (req.body?.text || '').toString().trim();
  if (!text) return res.status(400).json({ error: 'Missing text' });
  const list = comments.get(req.params.id) || [];
  const item = { id: String(Date.now()), text, at: new Date().toISOString() };
  list.push(item);
  comments.set(req.params.id, list);
  res.status(201).json(item);
});

module.exports = router;