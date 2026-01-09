// admin.js (ESM)
// iBand backend — admin routes (artists + comments)
// Must export default for server.js to import correctly.

import express from "express";

// These may currently be CommonJS. Default import works for CJS in Node ESM.
import ArtistsStore from "./artistsStore.js";
import CommentsStore from "./CommentsStore.js";

const router = express.Router();

// Optional admin key (dev mode if empty)
const ADMIN_KEY = process.env.ADMIN_KEY || "";

// ---------- Admin auth middleware ----------
function requireAdmin(req, res, next) {
  if (!ADMIN_KEY) return next();

  const key = req.headers["x-admin-key"];
  if (key !== ADMIN_KEY) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: invalid or missing x-admin-key",
    });
  }
  next();
}

// ---------- Admin diagnostics ----------
router.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "iBand admin API is running",
    docs: {
      ping: "/api/admin/ping",
      info: "/api/admin/info",
      artists: "/api/admin/artists",
      comments: "/api/admin/comments",
    },
  });
});

router.get("/ping", (_req, res) => {
  res.json({
    success: true,
    message: "pong",
    timestamp: new Date().toISOString(),
  });
});

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

// ---------- ARTISTS (admin) ----------

// GET /api/admin/artists
router.get("/artists", requireAdmin, (_req, res) => {
  const artists = ArtistsStore.getAllArtists();
  res.json({
    success: true,
    count: artists.length,
    artists,
  });
});

// POST /api/admin/artists
router.post("/artists", requireAdmin, (req, res) => {
  const { name, genre, bio, imageUrl } = req.body || {};
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: "name is required",
    });
  }

  const artist = ArtistsStore.createArtist({ name, genre, bio, imageUrl });

  res.status(201).json({
    success: true,
    artist,
  });
});

// PUT /api/admin/artists/:id
router.put("/artists/:id", requireAdmin, (req, res) => {
  const updated = ArtistsStore.updateArtist(req.params.id, req.body || {});
  if (!updated) {
    return res.status(404).json({
      success: false,
      message: "Artist not found",
    });
  }
  res.json({ success: true, artist: updated });
});

// PATCH /api/admin/artists/:id
router.patch("/artists/:id", requireAdmin, (req, res) => {
  const updated = ArtistsStore.updateArtist(req.params.id, req.body || {});
  if (!updated) {
    return res.status(404).json({
      success: false,
      message: "Artist not found",
    });
  }
  res.json({ success: true, artist: updated });
});

// DELETE /api/admin/artists/:id
router.delete("/artists/:id", requireAdmin, (req, res) => {
  const removed = ArtistsStore.deleteArtist(req.params.id);
  if (!removed) {
    return res.status(404).json({
      success: false,
      message: "Artist not found",
    });
  }

  // Also remove comments for this artist (if any)
  CommentsStore.deleteByArtist(req.params.id);

  res.json({
    success: true,
    message: "Artist and related comments deleted",
  });
});

// ---------- COMMENTS (admin) ----------

// GET /api/admin/comments
router.get("/comments", requireAdmin, (_req, res) => {
  const comments = CommentsStore.getAll();
  res.json({
    success: true,
    count: comments.length,
    comments,
  });
});

// PATCH /api/admin/comments/:id
router.patch("/comments/:id", requireAdmin, (req, res) => {
  const updated = CommentsStore.update(req.params.id, req.body || {});
  if (!updated) {
    return res.status(404).json({
      success: false,
      message: "Comment not found",
    });
  }
  res.json({
    success: true,
    comment: updated,
  });
});

// DELETE /api/admin/comments/:id
router.delete("/comments/:id", requireAdmin, (req, res) => {
  const removed = CommentsStore.delete(req.params.id);
  if (!removed) {
    return res.status(404).json({
      success: false,
      message: "Comment not found",
    });
  }
  res.json({
    success: true,
    message: "Comment deleted",
  });
});

// POST /api/admin/comments/reset
router.post("/comments/reset", requireAdmin, (_req, res) => {
  const deleted = CommentsStore.reset();
  res.json({
    success: true,
    deleted,
    message: "All comments reset",
  });
});

export default router;