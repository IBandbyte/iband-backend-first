// routes/artists.fake.js — minimal, in-memory Artists API for tests
// Tests mount this directly: app.use('/artists', require('../routes/artists.fake'))
// No DB; keeps state in memory so Jest runs fast and deterministically.

const express = require('express');
const router = express.Router();

// --- In-memory dataset (stable ids so tests can rely on them) ---
const artists = [
  {
    _id: 'A1',
    name: 'Alpha',
    genre: 'Pop',
    bio: '',
    avatarUrl: '',
    votes: 0,
    comments: [],
    commentsCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: 'B2',
    name: 'Beta',
    genre: 'Rock',
    bio: '',
    avatarUrl: '',
    votes: 0,
    comments: [],
    commentsCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// helpers
const safe = (v, f = '') => (v ?? f).toString().trim();
const toListItem = (a) => ({
  _id: a._id,             // tests read first._id
  id: a._id,              // UI compatibility
  name: a.name,
  genre: a.genre || 'No genre set',
  votes: a.votes || 0,
  commentsCount: Array.isArray(a.comments) ? a.comments.length : a.commentsCount || 0,
});

// GET /artists → list (A→Z, deduped by name — simple for fake)
router.get('/', (_req, res) => {
  const seen = new Set();
  const list = [];
  for (const a of artists) {
    const key = (a.name || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    list.push(toListItem(a));
  }
  list.sort((a, b) => a.name.localeCompare(b.name));
  res.json(list);
});

// GET /artists/:id → detail
router.get('/:id', (req, res) => {
  const id = safe(req.params.id);
  const a = artists.find((x) => x._id === id);
  if (!a) return res.status(404).json({ error: 'Artist not found' });
  res.json({
    _id: a._id,
    id: a._id,
    name: a.name,
    genre: a.genre || 'No genre set',
    bio: a.bio || '',
    avatarUrl: a.avatarUrl || '',
    votes: a.votes || 0,
    commentsCount: Array.isArray(a.comments) ? a.comments.length : a.commentsCount || 0,
    comments: (a.comments || []).map((c) => ({
      name: c.name || 'Anon',
      text: c.text,
      createdAt: c.createdAt,
    })),
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  });
});

// POST /artists/:id/vote → increments votes
// Tests expect 200 with { ok: true, votes: number }
router.post('/:id/vote', (req, res) => {
  const id = safe(req.params.id);
  const a = artists.find((x) => x._id === id);
  if (!a) return res.status(404).json({ error: 'Artist not found' });
  const deltaRaw = req.body?.delta;
  const delta =
    typeof deltaRaw === 'number' && Number.isFinite(deltaRaw)
      ? Math.trunc(deltaRaw)
      : 1;
  a.votes = Math.max(0, (a.votes || 0) + delta);
  a.updatedAt = new Date();
  res.json({ ok: true, votes: a.votes });
});

// GET /artists/:id/comments → { count, comments }
router.get('/:id/comments', (req, res) => {
  const id = safe(req.params.id);
  const a = artists.find((x) => x._id === id);
  if (!a) return res.status(404).json({ error: 'Artist not found' });
  const comments = Array.isArray(a.comments) ? a.comments : [];
  const sorted = [...comments].sort(
    (x, y) => new Date(y.createdAt || 0) - new Date(x.createdAt || 0)
  );
  res.json({
    count: sorted.length,
    comments: sorted.map((c) => ({
      name: c.name || 'Anon',
      text: c.text,
      createdAt: c.createdAt,
    })),
  });
});

// POST /artists/:id/comments → add comment; returns { id, commentsCount }
router.post('/:id/comments', (req, res) => {
  const id = safe(req.params.id);
  const a = artists.find((x) => x._id === id);
  if (!a) return res.status(404).json({ error: 'Artist not found' });

  const name = safe(req.body?.name || 'Anon').slice(0, 60) || 'Anon';
  const text = safe(req.body?.text);
  if (!text) return res.status(400).json({ error: 'Comment text required' });

  a.comments = Array.isArray(a.comments) ? a.comments : [];
  a.comments.push({ name, text, createdAt: new Date() });
  a.commentsCount = a.comments.length;
  a.updatedAt = new Date();

  res.json({ id: a._id, commentsCount: a.commentsCount });
});

module.exports = router;