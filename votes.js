const express = require('express');
const router = express.Router();
const voteTotals = {};
router.post('/', (req, res) => { const { artistId } = req.body; if (!artistId) return res.status(400).json({ error: 'artistId is required' }); voteTotals[artistId] = (voteTotals[artistId] || 0) + 1; res.json({ artistId, votes: voteTotals[artistId] }); });
router.get('/:artistId', (req, res) => res.json({ artistId: req.params.artistId, votes: voteTotals[req.params.artistId] || 0 }));
module.exports = router;
