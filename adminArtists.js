import express from "express";
import artistsStore from "./artistsStore.js";

const router = express.Router();

/**
 * Helpers
 */
function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeArtistPayload(body = {}) {
  return {
    name: isNonEmptyString(body.name) ? body.name.trim() : undefined,
    genre: isNonEmptyString(body.genre) ? body.genre.trim() : undefined,
    bio: isNonEmptyString(body.bio) ? body.bio.trim() : undefined,
    imageUrl: isNonEmptyString(body.imageUrl) ? body.imageUrl.trim() : undefined,
  };
}

/**
 * GET /api/admin/artists
 */
router.get("/", (req, res) => {
  const artists = artistsStore.getAll();
  return res.status(200).json({
    success: true,
    count: artists.length,
    artists,
  });
});

/**
 * GET /api/admin/artists/:id
 */
router.get("/:id", (req, res) => {
  const artist = artistsStore.getById(req.params.id);
  if (!artist) {
    return res.status(404).json({ success: false, message: "Artist not found." });
  }
  return res.status(200).json({ success: true, artist });
});

/**
 * POST /api/admin/artists
 * Create new artist
 */
router.post("/", (req, res) => {
  const payload = normalizeArtistPayload(req.body);

  if (!payload.name) {
    return res.status(400).json({
      success: false,
      message: "Validation error: 'name' is required.",
    });
  }

  const created = artistsStore.create({
    name: payload.name,
    genre: payload.genre ?? "Unknown",
    bio: payload.bio ?? "",
    imageUrl: payload.imageUrl ?? "",
  });

  return res.status(201).json({
    success: true,
    message: "Artist created successfully.",
    artist: created,
  });
});

/**
 * PUT /api/admin/artists/:id
 * Replace full artist (requires name)
 */
router.put("/:id", (req, res) => {
  const existing = artistsStore.getById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "Artist not found." });
  }

  const payload = normalizeArtistPayload(req.body);

  if (!payload.name) {
    return res.status(400).json({
      success: false,
      message: "Validation error: 'name' is required.",
    });
  }

  const updated = artistsStore.update(req.params.id, {
    name: payload.name,
    genre: payload.genre ?? "Unknown",
    bio: payload.bio ?? "",
    imageUrl: payload.imageUrl ?? "",
  });

  return res.status(200).json({
    success: true,
    message: "Artist updated successfully.",
    artist: updated,
  });
});

/**
 * PATCH /api/admin/artists/:id
 * Partial update
 */
router.patch("/:id", (req, res) => {
  const existing = artistsStore.getById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "Artist not found." });
  }

  const payload = normalizeArtistPayload(req.body);

  // No valid fields
  if (
    payload.name === undefined &&
    payload.genre === undefined &&
    payload.bio === undefined &&
    payload.imageUrl === undefined
  ) {
    return res.status(400).json({
      success: false,
      message: "No valid fields provided to update.",
    });
  }

  const updated = artistsStore.patch(req.params.id, payload);

  return res.status(200).json({
    success: true,
    message: "Artist patched successfully.",
    artist: updated,
  });
});

/**
 * DELETE /api/admin/artists/:id
 */
router.delete("/:id", (req, res) => {
  const existing = artistsStore.getById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "Artist not found." });
  }

  const deleted = artistsStore.remove(req.params.id);

  return res.status(200).json({
    success: true,
    message: "Artist deleted successfully.",
    artist: deleted,
  });
});

/**
 * POST /api/admin/artists/reset
 * Delete all artists
 */
router.post("/reset", (req, res) => {
  const deleted = artistsStore.reset();
  return res.status(200).json({
    success: true,
    deleted,
    message: "All artists have been deleted.",
  });
});

/**
 * POST /api/admin/artists/seed
 * Seed demo artists
 */
router.post("/seed", (req, res) => {
  const seeded = artistsStore.seed();
  return res.status(200).json({
    success: true,
    seeded,
    message: "Demo artists seeded successfully.",
  });
});

/**
 * ✅ CRITICAL FIX:
 * Provide default export so admin.js can import it as default.
 */
export default router;