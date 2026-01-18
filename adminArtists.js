// adminArtists.js (ESM)
// Admin artists control API — aligned with artistsStore.js
//
// Mounted at: /api/admin/artists
//
// Supports:
// - list
// - get by id
// - create
// - put (replace)
// - patch (partial)
// - delete

import express from "express";
import artistsStore from "./artistsStore.js";

const router = express.Router();

/* -------------------- Helpers -------------------- */

const asString = (v) => String(v ?? "").trim();

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeArtistPayload(body = {}) {
  const socials = body.socials && typeof body.socials === "object" ? body.socials : {};
  const tracks = Array.isArray(body.tracks) ? body.tracks : undefined;

  return {
    id: isNonEmptyString(body.id) ? body.id.trim() : undefined,
    name: isNonEmptyString(body.name) ? body.name.trim() : undefined,
    genre: isNonEmptyString(body.genre) ? body.genre.trim() : undefined,
    location: isNonEmptyString(body.location) ? body.location.trim() : undefined,
    bio: isNonEmptyString(body.bio) ? body.bio.trim() : undefined,
    imageUrl: isNonEmptyString(body.imageUrl) ? body.imageUrl.trim() : undefined,
    socials: {
      instagram: isNonEmptyString(socials.instagram) ? socials.instagram.trim() : undefined,
      tiktok: isNonEmptyString(socials.tiktok) ? socials.tiktok.trim() : undefined,
      youtube: isNonEmptyString(socials.youtube) ? socials.youtube.trim() : undefined,
      spotify: isNonEmptyString(socials.spotify) ? socials.spotify.trim() : undefined,
      soundcloud: isNonEmptyString(socials.soundcloud) ? socials.soundcloud.trim() : undefined,
      website: isNonEmptyString(socials.website) ? socials.website.trim() : undefined,
    },
    tracks,
    status: isNonEmptyString(body.status) ? body.status.trim() : undefined,
    votes: body.votes !== undefined ? Number(body.votes) : undefined,
  };
}

function stripUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

/* -------------------- Routes -------------------- */

/**
 * GET /api/admin/artists
 */
router.get("/", (_req, res) => {
  const artists = artistsStore.listArtists();
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
  const artist = artistsStore.getArtist(req.params.id);
  if (!artist) {
    return res.status(404).json({ success: false, message: "Artist not found." });
  }
  return res.status(200).json({ success: true, artist });
});

/**
 * POST /api/admin/artists
 * Create new artist (requires name)
 */
router.post("/", (req, res) => {
  const payload = normalizeArtistPayload(req.body);

  if (!payload.name) {
    return res.status(400).json({
      success: false,
      message: "Validation error: 'name' is required.",
    });
  }

  const created = artistsStore.createArtist(
    stripUndefined({
      id: payload.id,
      name: payload.name,
      genre: payload.genre ?? "Unknown",
      location: payload.location ?? "",
      bio: payload.bio ?? "",
      imageUrl: payload.imageUrl ?? "",
      socials: payload.socials,
      tracks: payload.tracks ?? [],
      status: payload.status ?? "active",
      votes: Number.isFinite(payload.votes) ? payload.votes : 0,
    })
  );

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
  const existing = artistsStore.getArtist(req.params.id);
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

  const updated = artistsStore.updateArtist(req.params.id, {
    name: payload.name,
    genre: payload.genre ?? "Unknown",
    location: payload.location ?? "",
    bio: payload.bio ?? "",
    imageUrl: payload.imageUrl ?? "",
    socials: payload.socials,
    tracks: payload.tracks ?? [],
    status: payload.status ?? existing.status,
    votes: Number.isFinite(payload.votes) ? payload.votes : existing.votes,
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
  const existing = artistsStore.getArtist(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "Artist not found." });
  }

  const payload = normalizeArtistPayload(req.body);

  // If nothing valid provided, reject
  const patch = stripUndefined({
    name: payload.name,
    genre: payload.genre,
    location: payload.location,
    bio: payload.bio,
    imageUrl: payload.imageUrl,
    socials: payload.socials,
    tracks: payload.tracks,
    status: payload.status,
    votes: Number.isFinite(payload.votes) ? payload.votes : undefined,
  });

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({
      success: false,
      message: "No valid fields provided to update.",
    });
  }

  const updated = artistsStore.updateArtist(req.params.id, {
    ...existing,
    ...patch,
  });

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
  const existing = artistsStore.getArtist(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "Artist not found." });
  }

  const ok = artistsStore.deleteArtist(req.params.id);

  return res.status(200).json({
    success: true,
    message: "Artist deleted successfully.",
    deleted: ok,
  });
});

export default router;