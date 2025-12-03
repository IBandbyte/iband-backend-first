// src/admin.js
// iBand - Admin router (mounted at /admin in server.js)
//
// All routes here are protected by a simple shared-secret header:
//   x-admin-secret: <your-secret>
// The secret is read from process.env.ADMIN_SECRET (or a dev default).

const express = require('express');
const mongoose = require('mongoose');

const Artist = require('../models/artistModel');
const Vote = require('../models/voteModel');
const Comment = require('../models/commentModel'); // make sure this exists

const router = express.Router();

// ---------------------------------------------------------------------
// Admin Auth Middleware
// ---------------------------------------------------------------------
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'dev-admin-secret';

function requireAdmin(req, res, next) {
  const headerSecret = req.headers['x-admin-secret'];

  if (!headerSecret || headerSecret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: invalid admin secret' });
  }

  return next();
}

// Helper for validating Mongo IDs
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Apply admin middleware to everything in this router
router.use(requireAdmin);

// ---------------------------------------------------------------------
// GET /admin/health
// Simple admin health check
// ---------------------------------------------------------------------
router.get('/health', (_req, res) => {
  return res.json({ ok: true, service: 'iBand Admin API' });
});

// ---------------------------------------------------------------------
// ARTIST ADMIN
// ---------------------------------------------------------------------
//
// NOTE: This assumes your Artist model has (or can accept) fields:
// - isActive (Boolean)
// - isDeleted (Boolean)
// If they don't exist yet, MongoDB will add them dynamically.

// GET /admin/artists
// Optional query params:
//   status=active|inactive|deleted (default = all)
// ---------------------------------------------------------------------
router.get('/artists', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};

    if (status === 'active') {
      filter.isActive = true;
      filter.isDeleted = { $ne: true };
    } else if (status === 'inactive') {
      filter.isActive = false;
      filter.isDeleted = { $ne: true };
    } else if (status === 'deleted') {
      filter.isDeleted = true;
    }

    const artists = await Artist.find(filter).sort({ createdAt: -1 }).lean();

    return res.json(artists);
  } catch (err) {
    console.error('Admin - error fetching artists:', err);
    return res.status(500).json({ error: 'Admin server error fetching artists' });
  }
});

// PATCH /admin/artists/:id/activate
// Sets isActive=true, isDeleted=false
// ---------------------------------------------------------------------
router.patch('/artists/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid artist ID' });
    }

    const updated = await Artist.findByIdAndUpdate(
      id,
      { isActive: true, isDeleted: false },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    return res.json(updated);
  } catch (err) {
    console.error('Admin - error activating artist:', err);
    return res.status(500).json({ error: 'Admin server error activating artist' });
  }
});

// PATCH /admin/artists/:id/deactivate
// Sets isActive=false (does not hard delete)
// ---------------------------------------------------------------------
router.patch('/artists/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid artist ID' });
    }

    const updated = await Artist.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    return res.json(updated);
  } catch (err) {
    console.error('Admin - error deactivating artist:', err);
    return res.status(500).json({ error: 'Admin server error deactivating artist' });
  }
});

// DELETE /admin/artists/:id
// Hard delete artist (admin-only, more powerful than public delete)
// ---------------------------------------------------------------------
router.delete('/artists/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid artist ID' });
    }

    const deleted = await Artist.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    return res.json({ success: true, deletedId: id });
  } catch (err) {
    console.error('Admin - error hard deleting artist:', err);
    return res.status(500).json({ error: 'Admin server error deleting artist' });
  }
});

// ---------------------------------------------------------------------
// COMMENT ADMIN
// ---------------------------------------------------------------------
//
// We assume Comment model has fields:
// - artistId (ObjectId)
// - isApproved (Boolean, default false)
// - isDeleted (Boolean) optional

// GET /admin/comments/pending
// List all comments where isApproved=false and not deleted
// ---------------------------------------------------------------------
router.get('/comments/pending', async (_req, res) => {
  try {
    const filter = {
      isApproved: false,
      $or: [{ isDeleted: { $exists: false } }, { isDeleted: { $ne: true } }],
    };

    const comments = await Comment.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return res.json(comments);
  } catch (err) {
    console.error('Admin - error fetching pending comments:', err);
    return res.status(500).json({ error: 'Admin server error fetching comments' });
  }
});

// PATCH /admin/comments/:id/approve
// Sets isApproved=true
// ---------------------------------------------------------------------
router.patch('/comments/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid comment ID' });
    }

    const updated = await Comment.findByIdAndUpdate(
      id,
      { isApproved: true },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    return res.json(updated);
  } catch (err) {
    console.error('Admin - error approving comment:', err);
    return res.status(500).json({ error: 'Admin server error approving comment' });
  }
});

// PATCH /admin/comments/:id/reject
// Sets isApproved=false (can be used to hide comment)
// ---------------------------------------------------------------------
router.patch('/comments/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid comment ID' });
    }

    const updated = await Comment.findByIdAndUpdate(
      id,
      { isApproved: false },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    return res.json(updated);
  } catch (err) {
    console.error('Admin - error rejecting comment:', err);
    return res.status(500).json({ error: 'Admin server error rejecting comment' });
  }
});

// DELETE /admin/comments/:id
// Soft delete (isDeleted=true) or hard delete if needed
// ---------------------------------------------------------------------
router.delete('/comments/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid comment ID' });
    }

    // Attempt soft delete
    const softDeleted = await Comment.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );

    if (softDeleted) {
      return res.json(softDeleted);
    }

    // Fallback: hard delete
    const hardDeleted = await Comment.findByIdAndDelete(id);

    if (!hardDeleted) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Admin - error deleting comment:', err);
    return res.status(500).json({ error: 'Admin server error deleting comment' });
  }
});

// ---------------------------------------------------------------------
// VOTE ADMIN
// ---------------------------------------------------------------------
//
// GET /admin/votes/summary
// Aggregated vote counts per artist, including artist name if available
// ---------------------------------------------------------------------
router.get('/votes/summary', async (_req, res) => {
  try {
    const aggregation = await Vote.aggregate([
      {
        $group: {
          _id: '$artistId',
          totalVotes: { $sum: 1 },
        },
      },
      { $sort: { totalVotes: -1 } },
    ]);

    // Optionally populate artist names
    const artistIds = aggregation.map((item) => item._id).filter(Boolean);

    const artists = await Artist.find({ _id: { $in: artistIds } })
      .select({ name: 1 })
      .lean();

    const artistMap = {};
    artists.forEach((a) => {
      artistMap[String(a._id)] = a.name;
    });

    const result = aggregation.map((item) => ({
      artistId: item._id,
      artistName: artistMap[String(item._id)] || null,
      totalVotes: item.totalVotes,
    }));

    return res.json(result);
  } catch (err) {
    console.error('Admin - error summarising votes:', err);
    return res.status(500).json({ error: 'Admin server error summarising votes' });
  }
});

module.exports = router;