// adminArtists.js (ESM)
// Admin artists control API — aligned with artistsStore.js
//
// Mounted at: /api/admin/artists
//
// ✅ Adds filtering so Admin Inbox tabs work properly:
//    GET /api/admin/artists?status=pending&q=&page=&limit=
//
// ✅ Adds canonical approve/reject endpoints:
//    POST  /api/admin/artists/:id/approve
//    POST  /api/admin/artists/:id/reject
//    PATCH /api/admin/artists/:id  (still supported)
//
// ✅ Keeps CRUD endpoints (create/put/patch/delete)

import express from "express";
import artistsStore from "./artistsStore.js";

const router = express.Router();

/* -------------------- Helpers -------------------- */

function safeText(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function toNumber(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeStatus(s) {
  const v = safeText(s).toLowerCase();
  if (!v) return "";
  if (["pending", "active", "rejected"].includes(v)) return v;
  if (v === "all" || v === "*") return "all";
  return "";
}

function matchesQ(artist, q) {
  const needle = safeText(q).toLowerCase();
  if (!needle) return true;

  const hay = [
    artist?.name,
    artist?.genre,
    artist?.location,
    artist?.bio,
    artist?.id,
    artist?.status,
  ]
    .map((x) => safeText(x).toLowerCase())
    .join(" ");

  return hay.includes(needle);
}

function storeList() {
  if (typeof artistsStore.getAll === "function") return artistsStore.getAll();
  if (typeof artistsStore.listArtists === "function") return artistsStore.listArtists();
  return [];
}

function storeGetById(id) {
  if (typeof artistsStore.getById === "function") return artistsStore.getById(id);
  if (typeof artistsStore.getArtist === "function") return artistsStore.getArtist(id);
  return null;
}

function storeCreate(payload) {
  if (typeof artistsStore.create === "function") return artistsStore.create(payload);
  if (typeof artistsStore.createArtist === "function") return artistsStore.createArtist(payload);
  return null;
}

function storePatch(id, patch) {
  if (typeof artistsStore.patch === "function") return artistsStore.patch(id, patch);
  if (typeof artistsStore.patchArtist === "function") return artistsStore.patchArtist(id, patch);

  // fallback: updateArtist exists but expects full object sometimes
  if (typeof artistsStore.updateArtist === "function") {
    const existing = storeGetById(id);
    if (!existing) return null;
    return artistsStore.updateArtist(id, { ...existing, ...patch });
  }

  return null;
}

function storeDelete(id) {
  if (typeof artistsStore.remove === "function") return artistsStore.remove(id);
  if (typeof artistsStore.deleteArtist === "function") return artistsStore.deleteArtist(id);
  return null;
}

function stripUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function normalizeArtistPayload(body = {}) {
  const socials = body.socials && typeof body.socials === "object" ? body.socials : {};
  const tracks = Array.isArray(body.tracks) ? body.tracks : undefined;

  return {
    id: safeText(body.id) || undefined,
    name: safeText(body.name) || undefined,
    genre: safeText(body.genre) || undefined,
    location: safeText(body.location) || undefined,
    bio: safeText(body.bio) || undefined,
    imageUrl: safeText(body.imageUrl) || undefined,
    socials: {
      instagram: safeText(socials.instagram) || undefined,
      tiktok: safeText(socials.tiktok) || undefined,
      youtube: safeText(socials.youtube) || undefined,
      spotify: safeText(socials.spotify) || undefined,
      soundcloud: safeText(socials.soundcloud) || undefined,
      website: safeText(socials.website) || undefined,
    },
    tracks,
    status: safeText(body.status) || undefined,
    votes: body.votes !== undefined ? Number(body.votes) : undefined,
    moderationNote: safeText(body.moderationNote) || undefined,
  };
}

/* -------------------- Routes -------------------- */

/**
 * ✅ GET /api/admin/artists
 * Supports:
 *   ?status=pending|active|rejected|all
 *   ?q=
 *   ?page=
 *   ?limit=
 */
router.get("/", (req, res) => {
  const status = normalizeStatus(req.query?.status) || "pending";
  const q = safeText(req.query?.q || req.query?.query);
  const page = Math.max(1, toNumber(req.query?.page, 1));
  const limit = Math.min(100, Math.max(1, toNumber(req.query?.limit, 50)));

  let list = storeList();
  list = Array.isArray(list) ? list : [];

  if (status !== "all") {
    list = list.filter((a) => safeText(a?.status).toLowerCase() === status);
  }

  list = list.filter((a) => matchesQ(a, q));

  const total = list.length;
  const start = (page - 1) * limit;
  const paged = list.slice(start, start + limit);

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
  const artist = storeGetById(req.params.id);
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

  const created = storeCreate(
    stripUndefined({
      id: payload.id,
      name: payload.name,
      genre: payload.genre ?? "Unknown",
      location: payload.location ?? "",
      bio: payload.bio ?? "",
      imageUrl: payload.imageUrl ?? "",
      socials: payload.socials,
      tracks: payload.tracks ?? [],
      status: normalizeStatus(payload.status) || "active",
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
 * ✅ POST /api/admin/artists/:id/approve
 * Sets status to active
 */
router.post("/:id/approve", (req, res) => {
  const id = safeText(req.params.id);
  const existing = storeGetById(id);
  if (!existing) return res.status(404).json({ success: false, message: "Artist not found." });

  const note = safeText(req.body?.moderationNote || "Approved via admin");

  const updated = storePatch(id, {
    status: "active",
    moderationNote: note,
  });

  return res.status(200).json({
    success: true,
    message: "Artist approved.",
    artist: updated,
  });
});

/**
 * ✅ POST /api/admin/artists/:id/reject
 * Sets status to rejected
 */
router.post("/:id/reject", (req, res) => {
  const id = safeText(req.params.id);
  const existing = storeGetById(id);
  if (!existing) return res.status(404).json({ success: false, message: "Artist not found." });

  const note = safeText(req.body?.moderationNote || "Rejected via admin");

  const updated = storePatch(id, {
    status: "rejected",
    moderationNote: note,
  });

  return res.status(200).json({
    success: true,
    message: "Artist rejected.",
    artist: updated,
  });
});

/**
 * PUT /api/admin/artists/:id
 * Replace full artist (requires name)
 */
router.put("/:id", (req, res) => {
  const existing = storeGetById(req.params.id);
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

  const updated = storePatch(req.params.id, {
    name: payload.name,
    genre: payload.genre ?? "Unknown",
    location: payload.location ?? "",
    bio: payload.bio ?? "",
    imageUrl: payload.imageUrl ?? "",
    socials: payload.socials,
    tracks: payload.tracks ?? [],
    status: normalizeStatus(payload.status) || existing.status,
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
 * Partial update (canonical)
 */
router.patch("/:id", (req, res) => {
  const existing = storeGetById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "Artist not found." });
  }

  const payload = normalizeArtistPayload(req.body);

  const patch = stripUndefined({
    name: payload.name,
    genre: payload.genre,
    location: payload.location,
    bio: payload.bio,
    imageUrl: payload.imageUrl,
    socials: payload.socials,
    tracks: payload.tracks,
    status: normalizeStatus(payload.status) || undefined,
    votes: Number.isFinite(payload.votes) ? payload.votes : undefined,
    moderationNote: payload.moderationNote,
  });

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({
      success: false,
      message: "No valid fields provided to update.",
    });
  }

  const updated = storePatch(req.params.id, patch);

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
  const existing = storeGetById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "Artist not found." });
  }

  const removed = storeDelete(req.params.id);

  return res.status(200).json({
    success: true,
    message: "Artist deleted successfully.",
    deleted: removed,
  });
});

export default router;