const express = require('express');
const { v4: uuid } = require('uuid');
const router = express.Router();
const artists = [{ id: 'a1', name: 'Demo Artist', genre: 'Pop', votes: 5, createdAt: new Date().toISOString() }];
router.get('/', (req, res) => res.json(artists));
router.get('/:id', (req, res) => { const a = artists.find(x => x.id === req.params.id); if (!a) return res.status(404).json({ error: 'Artist not found' }); res.json(a); });
router.post('/', (req, res) => { const { name, genre } = req.body; if (!name) return res.status(400).json({ error: 'Name is required' }); const artist = { id: uuid(), name, genre: genre || 'Unknown', votes: 0, createdAt: new Date().toISOString() }; artists.push(artist); res.status(201).json(artist); });
module.exports = router;
