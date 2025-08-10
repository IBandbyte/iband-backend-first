const express = require('express');
const { v4: uuid } = require('uuid');
const router = express.Router();
const comments = [];
router.get('/:artistId', (req, res) => res.json(comments.filter(c => c.artistId === req.params.artistId)));
router.post('/', (req, res) => { const { artistId, user, text } = req.body; if (!artistId || !text) return res.status(400).json({ error: 'artistId and text are required' }); const c = { id: uuid(), artistId, user: user || 'Anonymous', text, createdAt: new Date().toISOString() }; comments.push(c); res.status(201).json(c); });
module.exports = router;
