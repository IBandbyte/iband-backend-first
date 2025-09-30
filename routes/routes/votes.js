// routes/votes.js — voting + comments routes

const express = require('express');
const router = express.Router();
const votesService = require('../services/votesService');

// POST /votes/:artistId — cast a vote
router.post('/:artistId', async (req, res) => {
  try {
    const { artistId } = req.params;
    const vote = await votesService.castVote(artistId);
    res.status(201).json(vote);
  } catch (err) {
    console.error('❌ Vote error:', err.message);
    res.status(500).json({ error: 'Failed to cast vote' });
  }
});

// GET /votes/:artistId — get vote count
router.get('/:artistId', async (req, res) => {
  try {
    const { artistId } = req.params;
    const count = await votesService.getVotes(artistId);
    res.json({ artistId, votes: count });
  } catch (err) {
    console.error('❌ Get votes error:', err.message);
    res.status(500).json({ error: 'Failed to fetch votes' });
  }
});

// POST /votes/:artistId/comments — add a comment
router.post('/:artistId/comments', async (req, res) => {
  try {
    const { artistId } = req.params;
    const { text, user } = req.body;
    const comment = await votesService.addComment(artistId, text, user);
    res.status(201).json(comment);
  } catch (err) {
    console.error('❌ Add comment error:', err.message);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// GET /votes/:artistId/comments — list comments
router.get('/:artistId/comments', async (req, res) => {
  try {
    const { artistId } = req.params;
    const comments = await votesService.getComments(artistId);
    res.json(comments);
  } catch (err) {
    console.error('❌ Get comments error:', err.message);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

module.exports = router;