// adminArtists.js
// Full admin CRUD for artists – backed by artistsStore.js

const express = require("express");
const router = express.Router();

const {
  getAllArtists,
  getArtistById,
  createArtist,
  updateArtist,
  patchArtist,
  deleteArtist,
  resetArtists,
  seedArtists,
} = require("./artistsStore");

// NOTE: We are not enforcing admin key yet to keep Hoppscotch tests simple.

// ───────────────────────────────────────────────
// Helper: Validate artist payload
// ───────────────────────────────────────────────
function validateArtistPayload(body, { partial = false } = {}) {
  if (!partial) {
    if (!body || !body.name || !body.genre) {
      return "Fields 'name' and 'genre' are required.";
    }
  } else {
    if (!body || Object.keys(body).length === 0) {
      return "At least one field is required for PATCH.";
    }
  }
  return null;
}

// ───────────────────────────────────────────────
// Admin endpoints
// Base: /api/admin/artists
// ───────────────────────────────────────────────

// POST /api/admin/artists/reset
router.post("/reset", (req, res) => {
  const { deleted } = resetArtists();
  res.json({
    success: true,
    deleted,
    message: "All artists have been deleted.",
  });
});

// POST /api/admin/artists/seed
router.post("/seed", (req, res) => {
  const { seeded } = seedArtists();
  res.json({
    success: true,
    seeded,
    message: "Demo artists seeded.",
  });
});

// GET /api/admin/artists
router.get("/", (req, res) => {
  const artists = getAllArtists();
  res.json({
    success: true,
    count: artists.length,
    artists,
  });
});

// GET /api/admin/artists/:id
router.get("/:id", (req, res) => {
  const { id } = req.params;
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
router.post("/", (req, res) => {
  const error = validateArtistPayload(req.body, { partial: false });
  if (error) {
    return res.status(400).json({
      success: false,
      message: error,
    });
  }

  const { name, genre, bio, imageUrl } = req.body;

  const artist = createArtist({
    name,
    genre,
    bio: bio || "",
    imageUrl: imageUrl || "",
  });

  res.status(201).json({
    success: true,
    message: "Artist created.",
    artist,
  });
});

// PUT /api/admin/artists/:id
router.put("/:id", (req, res) => {
  const { id } = req.params;

  const error = validateArtistPayload(req.body, { partial: false });
  if (error) {
    return res.status(400).json({
      success: false,
      message: error,
    });
  }

  const updated = updateArtist(id, {
    name: req.body.name,
    genre: req.body.genre,
    bio: req.body.bio || "",
    imageUrl: req.body.imageUrl || "",
  });

  if (!updated) {
    return res.status(404).json({
      success: false,
      message: "Artist not found.",
    });
  }

  res.json({
    success: true,
    message: `Artist ${id} updated.`,
    artist: updated,
  });
});

// PATCH /api/admin/artists/:id
router.patch("/:id", (req, res) => {
  const { id } = req.params;

  const error = validateArtistPayload(req.body, { partial: true });
  if (error) {
    return res.status(400).json({
      success: false,
      message: error,
    });
  }

  const allowed = ["name", "genre", "bio", "imageUrl"];
  const changes = {};

  for (const key of allowed) {
    if (key in req.body) changes[key] = req.body[key];
  }

  const patched = patchArtist(id, changes);

  if (!patched) {
    return res.status(404).json({
      success: false,
      message: "Artist not found.",
    });
  }

  res.json({
    success: true,
    message: `Artist ${id} patched.`,
    artist: patched,
  });
});

// DELETE /api/admin/artists/:id
router.delete("/:id", (req, res) => {
  const { id } = req.params;

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
    artist: removed,
  });
});

module.exports = router;