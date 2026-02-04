// adminArtists.js (ESM)
// Admin artists control API — authoritative
//
// Mounted at: /api/admin/artists
//
// Supports:
// - list (with status/q/page/limit)
// - get by id
// - create
// - put (replace)
// - patch (partial)
// - approve / reject (workflow endpoints)
// - delete

import express from "express";
import artistsStore from "./artistsStore.js";

const router = express.Router();

/* -------------------- Helpers -------------------- */

const safeText = (v) => (v === null || v === undefined ? "" : String(v)).trim();

const toNumber = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeStatus = (s) => {
  const v = safeText(s).toLowerCase();
  if (!v) return "";
  if (["active", "pending", "rejected"].includes(v)) return v;
  if (v === "all" || v === "*") return "all";
  return "";
};

function matchesQ(artist, q) {
  const needle = safeText(q).toLowerCase();
  if (!needle) return true;

  const hay = [
    artist?.name,
    artist?.genre,
    artist?.location,
    artist?.bio,
    artist?.id,
  ]
    .map((x) => safeText(x).toLowerCase())
    .join(" ");

  return hay.includes(needle);
}

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
 * GET /api/admin/artists?status=pending&q=&page=&limit=
 */
router.get("/", (req, res) => {
  const status = normalizeStatus(req.query?.status) || "all";
  const q = safeText(req.query?.q);
  const page = Math.max(1, toNumber(req.query?.page, 1));
  const limit = Math.min(100, Math.max(1, toNumber(req.query?.limit, 50)));

  const all = artistsStore.listArtists();
  let filtered = Array.isArray(all) ? all : [];

  if (status !== "all") {
    filtered = filtered.filter((a) => safeText(a?.status).toLowerCase() === status);
  }

  filtered = filtered.filter((a) => matchesQ(a, q));

  const total = filtered.length;
  const start = (page - 1) * limit;
  const paged = filtered.slice(start, start + limit);

  return res.status(200).json({
    success: true,
    count: paged.length,
    artists: paged,
    page,
    limit,
    total,
    status,
    q,
  });
});

/**
 * GET /api/admin/artists/:id
 */
router.get("/:id", (req, res) => {
  const id = safeText(req.params.id);
  const artist = artistsStore.getArtist(id);
  if (!artist) return res.status(404).json({ success: false, message: "Artist not found." });
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
  const id = safeText(req.params.id);
  const existing = artistsStore.getArtist(id);
  if (!existing) return res.status(404).json({ success: false, message: "Artist not found." });

  const payload = normalizeArtistPayload(req.body);
  if (!payload.name) {
    return res.status(400).json({
      success: false,
      message: "Validation error: 'name' is required.",
    });
  }

  const updated = artistsStore.updateArtist(id, {
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
  const id = safeText(req.params.id);
  const existing = artistsStore.getArtist(id);
  if (!existing) return res.status(404).json({ success: false, message: "Artist not found." });

  const payload = normalizeArtistPayload(req.body);

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

  const updated = artistsStore.patchArtist(id, patch);

  return res.status(200).json({
    success: true,
    message: "Artist patched successfully.",
    artist: updated,
  });
});

/**
 * PATCH /api/admin/artists/:id/approve
 * Sets status=active
 */
router.patch("/:id/approve", (req, res) => {
  const id = safeText(req.params.id);
  const existing = artistsStore.getArtist(id);
  if (!existing) return res.status(404).json({ success: false, message: "Artist not found." });

  const updated = artistsStore.patchArtist(id, { status: "active" });

  return res.status(200).json({
    success: true,
    message: "Artist approved.",
    artist: updated,
  });
});

/**
 * PATCH /api/admin/artists/:id/reject
 * Sets status=rejected
 */
router.patch("/:id/reject", (req, res) => {
  const id = safeText(req.params.id);
  const existing = artistsStore.getArtist(id);
  if (!existing) return res.status(404).json({ success: false, message: "Artist not found." });

  const updated = artistsStore.patchArtist(id, { status: "rejected" });

  return res.status(200).json({
    success: true,
    message: "Artist rejected.",
    artist: updated,
  });
});

/**
 * DELETE /api/admin/artists/:id
 */
router.delete("/:id", (req, res) => {
  const id = safeText(req.params.id);
  const existing = artistsStore.getArtist(id);
  if (!existing) return res.status(404).json({ success: false, message: "Artist not found." });

  const removed = artistsStore.deleteArtist(id);

  return res.status(200).json({
    success: true,
    message: "Artist deleted successfully.",
    deleted: removed,
  });
});

export default router;