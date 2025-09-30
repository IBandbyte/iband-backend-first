// routes/votes.js
// Route layer for voting + comments
const express = require('express');
const router = express.Router();

const votesService = require('../services/votesService');

// Cast a vote
router.post('/', async (req, res) => {
  try {
    const { artistId, voteType } = req.body;
    const result = await votesService.castVote(artistId, voteType);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get votes for an artist
router.get('/:artistId', async (req, res) => {
  try {
    const result = await votesService.getVotes(req.params.artistId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;