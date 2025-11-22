// votes.js
// Root-level Express router for fan votes (artists, content, etc.).
// Uses the in-memory votesService so tests + CI stay light,
// but is wired so we can later swap to a Mongo Vote model
// without changing the frontend or routes.
//
// Mounted from server.js as: app.use('/votes', votesRouter)
//
// Endpoints:
//   POST   /votes          -> cast / update a vote
//   GET    /votes/summary  -> get aggregate counts for a target
//   GET    /votes/user     -> get a user's current vote on a target
//   DELETE /votes/:id      -> delete a vote (admin / future auth)

const express = require('express');

// Artist model is used to safely validate artist votes.
// File path matches your current structure: models/artistModel.js at ROOT/models.
const Artist = require('./models/artistModel');

// Business logic lives in the in-memory votesService
// at ROOT/services/votesService.js
const votesService = require('./services/votesService');

const router = express.Router();

/**
 * POST /votes
 * Cast or update a vote.
 *
 * Body example:
 * {
 *   "userId": "user-123",          // optional (defaults to "anon")
 *   "targetType": "artist",        // optional (defaults to "artist")
 *   "targetId": "<artistId>",      // required
 *   "choice": "up"                 // optional (defaults to "up")
 * }
 */
router.post('/', async (req, res) => {
  try {
    let { userId, targetType, targetId, choice } = req.body;

    // Default & normalize
    targetType = (targetType || 'artist').toLowerCase();

    if (!targetId) {
      return res.status(400).json({ message: 'targetId is required.' });
    }

    // Optional safety: if voting on an artist, make sure the artist exists.
    if (targetType === 'artist') {
      const exists = await Artist.exists({ _id: targetId });
      if (!exists) {
        return res.status(404).json({ message: 'Artist not found.' });
      }
    }

    const ip = req.ip;
    const userAgent = req.headers['user-agent'] || '';

    const result = votesService.castVote({
      userId,
      targetType,
      targetId,
      choice,
      ip,
      userAgent,
    });

    // If a new vote was created, 201; if an existing one updated, 200.
    const statusCode = result.created ? 201 : 200;
    return res.status(statusCode).json(result);
  } catch (err) {
    const status = Number.isInteger(err.status) ? err.status : 500;
    console.error('POST /votes error:', err);
    return res
      .status(status)
      .json({ message: err.message || 'Failed to cast vote' });
  }
});

/**
 * GET /votes/summary
 *
 * Query example:
 *   /votes/summary?targetType=artist&targetId=<artistId>
 *
 * Response:
 * {
 *   "targetType": "artist",
 *   "targetId": "<id>",
 *   "total": 10,
 *   "breakdown": { "up": 9, "down": 1 },
 *   "lastUpdated": "2025-11-19T01:23:45.000Z"
 * }
 */
router.get('/summary', (req, res) => {
  try {
    const { targetType = 'artist', targetId } = req.query;

    if (!targetId) {
      return res.status(400).json({ message: 'targetId is required.' });
    }

    const summary = votesService.getSummary({ targetType, targetId });
    return res.json(summary);
  } catch (err) {
    console.error('GET /votes/summary error:', err);
    return res
      .status(500)
      .json({ message: err.message || 'Failed to get vote summary' });
  }
});

/**
 * GET /votes/user
 *
 * Query example:
 *   /votes/user?userId=user-123&targetType=artist&targetId=<artistId>
 *
 * Response:
 *   { "vote": { ... } }  // if found
 *   { "vote": null }     // if not found
 */
router.get('/user', (req, res) => {
  try {
    const { userId, targetType = 'artist', targetId } = req.query;

    if (!userId || !targetId) {
      return res
        .status(400)
        .json({ message: 'userId and targetId are required.' });
    }

    const vote = votesService.getUserVote({ userId, targetType, targetId });
    return res.json({ vote });
  } catch (err) {
    console.error('GET /votes/user error:', err);
    return res
      .status(500)
      .json({ message: err.message || 'Failed to get user vote' });
  }
});

/**
 * DELETE /votes/:id
 *
 * For now this is a generic "delete by id" endpoint. In future we can
 * restrict this to admins / the same user with auth middleware.
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const deleted = votesService.deleteVote(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Vote not found' });
    }

    return res.json({ message: 'Vote deleted successfully' });
  } catch (err) {
    console.error('DELETE /votes/:id error:', err);
    return res
      .status(500)
      .json({ message: err.message || 'Failed to delete vote' });
  }
});

module.exports = router;