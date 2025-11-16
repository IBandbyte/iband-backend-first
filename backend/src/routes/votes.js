// backend/src/routes/votes.js
// iBand - Votes routes (future-proof, Hoppscotch-friendly)

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// Vote model (we will create this file in a later step)
const Vote = require('../models/voteModel');

// =============== Helpers ===============

const successResponse = (data, meta = {}) => ({
  success: true,
  data,
  meta,
});

const errorResponse = (message, code = 'BAD_REQUEST', details = null) => ({
  success: false,
  error: {
    code,
    message,
    details,
  },
});

const parsePagination = (req) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(
    Math.max(parseInt(req.query.limit || '20', 10), 1),
    100
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const parseSort = (req, defaultSort = '-createdAt') => {
  const sort = req.query.sort || defaultSort;
  const allowedSortFields = ['createdAt', 'artistId', 'userId'];

  let field = sort;
  let direction = 1;

  if (sort.startsWith('-')) {
    field = sort.substring(1);
    direction = -1;
  }

  if (!allowedSortFields.includes(field)) {
    field = defaultSort.replace('-', '');
    direction = defaultSort.startsWith('-') ? -1 : 1;
  }

  return { [field]: direction };
};

// =============== ROUTES ===============
// Base path: /api/votes

/**
 * POST /api/votes
 * Cast a vote for an artist.
 *
 * Body:
 * - artistId (required)
 * - userId (optional, for when auth exists)
 * - deviceId (optional, string from client)
 * - source (optional, e.g. "web", "app", "campaign")
 * - campaignId (optional, string)
 * - preventDuplicate (optional boolean, default false)
 */
router.post('/', async (req, res) => {
  try {
    const {
      artistId,
      userId = null,
      deviceId = null,
      source = 'unknown',
      campaignId = null,
      preventDuplicate = false,
    } = req.body || {};

    if (!artistId) {
      return res
        .status(400)
        .json(
          errorResponse('artistId is required.', 'VALIDATION_ERROR', {
            field: 'artistId',
          })
        );
    }

    // Capture IP and user agent for basic anti-abuse / analytics
    const ipAddressRaw =
      (req.headers['x-forwarded-for'] &&
        req.headers['x-forwarded-for'].split(',')[0]) ||
      req.ip ||
      '';
    const ipAddress = ipAddressRaw.trim() || null;
    const userAgent = req.headers['user-agent'] || null;

    // Optional: prevent duplicate votes from same device/user/IP for same artist
    if (preventDuplicate) {
      const duplicateFilter = { artistId };

      if (userId) {
        duplicateFilter.userId = userId;
      } else if (deviceId) {
        duplicateFilter.deviceId = deviceId;
      } else if (ipAddress) {
        duplicateFilter.ipAddress = ipAddress;
      }

      const existing = await Vote.findOne(duplicateFilter);
      if (existing) {
        return res.status(409).json(
          errorResponse('Duplicate vote detected.', 'DUPLICATE_VOTE', {
            artistId,
          })
        );
      }
    }

    const voteData = {
      artistId,
      userId,
      deviceId,
      source,
      campaignId,
      ipAddress,
      userAgent,
    };

    const created = await Vote.create(voteData);

    return res.status(201).json(successResponse(created));
  } catch (err) {
    console.error('Error casting vote:', err);
    return res
      .status(500)
      .json(errorResponse('Failed to cast vote.', 'SERVER_ERROR'));
  }
});

/**
 * GET /api/votes
 * List votes with filters + pagination (mainly for admin / analytics).
 *
 * Query:
 * - artistId (optional)
 * - userId (optional)
 * - deviceId (optional)
 * - source (optional)
 * - campaignId (optional)
 * - page, limit, sort (optional)
 */
router.get('/', async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const sort = parseSort(req);

    const { artistId, userId, deviceId, source, campaignId } = req.query;

    const filter = {};

    if (artistId) filter.artistId = artistId;
    if (userId) filter.userId = userId;
    if (deviceId) filter.deviceId = deviceId;
    if (source) filter.source = source;
    if (campaignId) filter.campaignId = campaignId;

    const [items, total] = await Promise.all([
      Vote.find(filter).sort(sort).skip(skip).limit(limit),
      Vote.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return res.json(
      successResponse(items, {
        page,
        limit,
        total,
        totalPages,
      })
    );
  } catch (err) {
    console.error('Error listing votes:', err);
    return res
      .status(500)
      .json(errorResponse('Failed to fetch votes.', 'SERVER_ERROR'));
  }
});

/**
 * GET /api/votes/summary
 * Get vote totals, either:
 * - for a specific artistId, or
 * - for all artists (top N)
 *
 * Query:
 * - artistId (optional)
 * - limit (optional, default: 50, only used when artistId is NOT provided)
 */
router.get('/summary', async (req, res) => {
  try {
    const { artistId } = req.query;
    const limit =
      Math.min(
        Math.max(parseInt(req.query.limit || '50', 10), 1),
        500
      ) || 50;

    // If a specific artistId is provided, return total votes for that artist
    if (artistId) {
      let artistObjectId;

      try {
        artistObjectId = new mongoose.Types.ObjectId(artistId);
      } catch (e) {
        return res.status(400).json(
          errorResponse('Invalid artistId format.', 'VALIDATION_ERROR', {
            field: 'artistId',
          })
        );
      }

      const result = await Vote.aggregate([
        { $match: { artistId: artistObjectId } },
        {
          $group: {
            _id: '$artistId',
            totalVotes: { $sum: 1 },
          },
        },
      ]);

      const totalVotes = result[0]?.totalVotes || 0;

      return res.json(
        successResponse({
          artistId,
          totalVotes,
        })
      );
    }

    // Otherwise, return top artists by vote count
    const results = await Vote.aggregate([
      {
        $group: {
          _id: '$artistId',
          totalVotes: { $sum: 1 },
        },
      },
      { $sort: { totalVotes: -1 } },
      { $limit: limit },
    ]);

    const formatted = results.map((item) => ({
      artistId: item._id,
      totalVotes: item.totalVotes,
    }));

    return res.json(successResponse(formatted, { limit }));
  } catch (err) {
    console.error('Error fetching vote summary:', err);
    return res
      .status(500)
      .json(errorResponse('Failed to fetch vote summary.', 'SERVER_ERROR'));
  }
});

/**
 * GET /api/votes/:id
 * Get a single vote document by ID.
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const vote = await Vote.findById(id);

    if (!vote) {
      return res
        .status(404)
        .json(errorResponse('Vote not found.', 'NOT_FOUND'));
    }

    return res.json(successResponse(vote));
  } catch (err) {
    console.error('Error fetching vote:', err);
    return res
      .status(500)
      .json(errorResponse('Failed to fetch vote.', 'SERVER_ERROR'));
  }
});

/**
 * DELETE /api/votes/:id
 * Delete a vote (admin cleanup / fraud correction).
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Vote.findByIdAndDelete(id);

    if (!deleted) {
      return res
        .status(404)
        .json(errorResponse('Vote not found.', 'NOT_FOUND'));
    }

    return res.json(
      successResponse({
        message: 'Vote deleted.',
        id: deleted._id,
      })
    );
  } catch (err) {
    console.error('Error deleting vote:', err);
    return res
      .status(500)
      .json(errorResponse('Failed to delete vote.', 'SERVER_ERROR'));
  }
});

module.exports = router;