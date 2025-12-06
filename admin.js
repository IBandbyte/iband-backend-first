// admin.js
// Admin control endpoints for iBand backend.
// Provides diagnostics + full CRUD over artists, and admin controls for comments.

const express = require("express");
const router = express.Router();

const {
  getAllArtists,
  getArtistById,
  createArtist,
  updateArtist,
  deleteArtist,
  resetArtists,
  seedDemoArtists,
} = require("./artistsStore");

const {
  getAllComments,
  getCommentsByArtist,
  getCommentById,
  deleteComment,
  deleteCommentsByArtist,
  resetComments,
} = require("./commentsStore");

// Optional admin key. If not set, admin endpoints are OPEN (dev mode).
const ADMIN_KEY = process.env.ADMIN_KEY || "";

// Middleware to guard admin routes
function requireAdmin(req, res, next) {
  if (!ADMIN_KEY) {
    // No key set -> dev mode, allow everything.
    return next();
  }

  const key = req.headers["x-admin-key"];

  if (!key || key !== ADMIN_KEY) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: invalid or missing x-admin-key.",
    });
  }

  next();
}

// ----- BASIC ADMIN DIAGNOSTICS -----

// GET /api/admin
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "iBand admin API is running.",
    docs: {
      ping: "/api/admin/ping",
      info: "/api/admin/info",

      // Artist admin
      artistsList: "/api/admin/artists",
      artistsCreate: "/api/admin/artists (POST)",
      artistsUpdate: "/api/admin/artists/:id (PUT/PATCH)",
      artistsDelete: "/api/admin/artists/:id (DELETE)",
      artistsReset: "/api/admin/artists/reset (POST)",
      artistsSeed: "/api/admin/artists/seed (POST)",

      // Comment admin
      commentsList: "/api/admin/comments",
      commentsListForArtist:
        "/api/admin/comments?artistId={artistId}",
      commentGet: "/api/admin/comments/:id",
      commentDelete: "/api/admin/comments/:id (DELETE)",
      commentsDeleteForArtist:
        "/api/admin/comments/by-artist/:artistId (DELETE)",
      commentsReset: "/api/admin/comments/reset (POST)",
    },
  });
});

// GET /api/admin/ping
router.get("/ping", (_req, res) => {
  res.json({
    success: true,
    message: "pong",
    timestamp: new Date().toISOString(),
  });
});

// GET /api/admin/info
router.get("/info", (_req, res) => {
  res.json({
    success: true,
    env: {
      nodeVersion: process.version,
      uptime: process.uptime(),
      platform: process.platform,
    },
  });
});

// ----- ADMIN ARTIST CONTROL (FULL CRUD) -----

// GET /api/admin/artists
router.get("/artists", requireAdmin, (_req, res) => {
  const artists = getAllArtists();
  res.json({
    success: true,
    count: artists.length,
    artists,
  });
});

// GET /api/admin/artists/:id
router.get("/artists/:id", requireAdmin, (req, res) => {
  const id = req.params.id;
  const artist = getArtistById(id);

  if (!artist) {
    return res.status(404).json({
      success: false,
      message: "Artist not found.",
    });
  }

  res.json({
    success: true,
    artist,
  });
});

// POST /api/admin/artists
router.post("/artists", requireAdmin, (req, res) => {
  const { name, genre, bio, imageUrl } = req.body || {};

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: "Name is required.",
    });
  }

  const artist = createArtist({ name, genre, bio, imageUrl });

  res.status(201).json({
    success: true,
    artist,
  });
});

// PUT /api/admin/artists/:id
router.put("/artists/:id", requireAdmin, (req, res) => {
  const id = req.params.id;
  const { name, genre, bio, imageUrl } = req.body || {};

  const updated = updateArtist(id, { name, genre, bio, imageUrl });

  if (!updated) {
    return res.status(404).json({
      success: false,
      message: "Artist not found.",
    });
  }

  res.json({
    success: true,
    artist: updated,
  });
});

// PATCH /api/admin/artists/:id
router.patch("/artists/:id", requireAdmin, (req, res) => {
  const id = req.params.id;
  const patch = req.body || {};

  const updated = updateArtist(id, patch);

  if (!updated) {
    return res.status(404).json({
      success: false,
      message: "Artist not found.",
    });
  }

  res.json({
    success: true,
    artist: updated,
  });
});

// DELETE /api/admin/artists/:id
router.delete("/artists/:id", requireAdmin, (req, res) => {
  const id = req.params.id;
  const removed = deleteArtist(id);

  if (!removed) {
    return res.status(404).json({
      success: false,
      message: "Artist not found.",
    });
  }

  res.json({
    success: true,
    message: "Artist deleted.",
  });
});

// POST /api/admin/artists/reset
router.post("/artists/reset", requireAdmin, (_req, res) => {
  const deleted = resetArtists();

  res.json({
    success: true,
    deleted,
    message: "All artists have been removed.",
  });
});

// POST /api/admin/artists/seed
router.post("/artists/seed", requireAdmin, (_req, res) => {
  const count = seedDemoArtists();

  res.json({
    success: true,
    seeded: count,
    message: "Demo artists seeded.",
  });
});

// ----- ADMIN COMMENT CONTROL -----

// GET /api/admin/comments
// Optional query: ?artistId=1 to filter
router.get("/comments", requireAdmin, (req, res) => {
  const { artistId } = req.query;

  let comments;
  if (artistId) {
    comments = getCommentsByArtist(artistId);
  } else {
    comments = getAllComments();
  }

  res.json({
    success: true,
    count: comments.length,
    ...(artistId ? { artistId: String(artistId) } : {}),
    comments,
  });
});

// GET /api/admin/comments/:id
router.get("/comments/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const comment = getCommentById(id);

  if (!comment) {
    return res.status(404).json({
      success: false,
      message: "Comment not found.",
    });
  }

  res.json({
    success: true,
    comment,
  });
});

// DELETE /api/admin/comments/by-artist/:artistId
router.delete(
  "/comments/by-artist/:artistId",
  requireAdmin,
  (req, res) => {
    const { artistId } = req.params;
    const { deleted } = deleteCommentsByArtist(artistId);

    res.json({
      success: true,
      message: `Deleted ${deleted} comment(s) for artist ${artistId}.`,
      deleted,
      artistId: String(artistId),
    });
  }
);

// DELETE /api/admin/comments/:id
router.delete("/comments/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const deleted = deleteComment(id);

  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: "Comment not found.",
    });
  }

  res.json({
    success: true,
    message: "Comment deleted.",
    comment: deleted,
  });
});

// POST /api/admin/comments/reset
router.post("/comments/reset", requireAdmin, (_req, res) => {
  const deleted = resetComments();

  res.json({
    success: true,
    deleted,
    message: "All comments have been removed.",
  });
});

module.exports = router;