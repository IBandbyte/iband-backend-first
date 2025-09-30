// routes/artists.fake.js
// Test-only adapter that returns a stable, deduped, A→Z list of artists.

const express = require('express');
const router = express.Router();

// Small, deterministic seed set (already unique & sorted)
const ARTISTS = [
  { _id: 'A', name: 'Alpha' },
  { _id: 'B', name: 'Beta' },
  { _id: 'C', name: 'Cosmo' },
];

// GET / → array of {_id, name} (deduped & sorted)
router.get('/', (_req, res) => {
  // defensive: ensure sorted A→Z by name & unique by _id
  const seen = new Set();
  const list = ARTISTS.filter(a => {
    if (seen.has(a._id)) return false;
    seen.add(a._id);
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));

  res.status(200).json(list);
});

module.exports = router;