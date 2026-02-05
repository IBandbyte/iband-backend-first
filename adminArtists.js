// adminArtists.js (ESM)
// Admin artists control API — aligned with artistsStore.js
//
// Mounted at: /api/admin/artists
//
// Supports:
// - list with filters/pagination: GET /?status=&q=&page=&limit=
// - get by id: GET /:id
// - create: POST /
// - put (replace): PUT /:id
// - patch (partial): PATCH /:id  ✅ uses artistsStore.patchArtist
// - approve/reject convenience: PATCH /:id/approve , PATCH /:id/reject
// - delete: DELETE /:id

import express from "express";
import artistsStore from "./artistsStore.js";

const router = express.Router();

/* -------------------- Helpers -------------------- */

const safeText = (v) => String(v ?? "").trim();

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeStatus(v) {
  const s = safeText(v).toLowerCase();
  if (!s) return "";
  if (["pending", "active", "rejected"].includes(s)) return s;
  if (s === "all" || s === "*") return "all";
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
  ]
    .map((x) => safeText(x).toLowerCase())
    .join(" ");

  return hay.includes(needle);
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function stripUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
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

function storeList() {
  if (typeof artistsStore.listArtists === "function") return artistsStore.listArtists();
  if (typeof artistsStore.getAll === "function") return artistsStore.getAll();
  return [];
}

function storeGet(id) {
  if (typeof artistsStore.getArtist === "function") return artistsStore.getArtist(id);
  if (typeof artistsStore.getById === "function") return artistsStore.getById(id);
  return null;
}

function storeCreate(payload) {
  if (typeof artistsStore.createArtist === "function") return artistsStore.createArtist(payload);
  if (typeof artistsStore.create === "function") return artistsStore.create(payload);
  return null;
}

function storeUpdate(id, payload) {
  if (typeof artistsStore.updateArtist === "function") return artistsStore.updateArtist(id, payload);
  if (typeof artistsStore.update === "function") return artistsStore.update(id, payload);
  return null;
}

function storePatch(id, payload) {
  if (typeof artistsStore.patchArtist === "function") return artistsStore.patchArtist(id, payload);
  if (typeof artistsStore.patch === "function") return artistsStore.patch(id, payload);
  // last resort:
  return storeUpdate(id, { ...(storeGet(id) || {}), ...(payload || {}) });
}

function storeDelete(id) {
  if (typeof artistsStore.deleteArtist === "function") return artistsStore.deleteArtist(id);
  if (typeof artistsStore.remove === "function") return artistsStore.remove(id);
  return null;
}

/* -------------------- Routes -------------------- */

/**
 * GET /api/admin/artists?status=&q=&page=&limit=
 * ✅ NOW supports filters/pagination so Admin UI tabs work correctly
 */
router.get("/", (req, res) => {
  const status = normalizeStatus(req.query?.status) || "all";
  const q = safeText(req.query?.q);
  const page = Math.max(1, toNumber(req.query?.page, 1));
  const limit = Math.min(100, Math.max(1, toNumber(req.query?.limit, 50)));

  let list = storeList();

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
  const id = safeText(req.params?.id);
  const artist = storeGet(id);

  if (!artist) {
    return res.status(404).json({ success: false, message: "Artist not found.", id });
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
  const id = safeText(req.params?.id);
  const existing = storeGet(id);

  if (!existing) {
    return res.status(404).json({ success: false, message: "Artist not found.", id });
  }

  const payload = normalizeArtistPayload(req.body);

  if (!payload.name) {
    return res.status(400).json({
      success: false,
      message: "Validation error: 'name' is required.",
    });
  }

  const updated = storeUpdate(id, {
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
 * ✅ Partial update uses storePatch() (patchArtist) so status flips are safe
 */
router.patch("/:id", (req, res) => {
  const id = safeText(req.params?.id);
  const existing = storeGet(id);

  if (!existing) {
    return res.status(404).json({ success: false, message: "Artist not found.", id });
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
    status: payload.status,
    votes: Number.isFinite(payload.votes) ? payload.votes : undefined,
  });

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({
      success: false,
      message: "No valid fields provided to update.",
    });
  }

  const updated = storePatch(id, patch);

  return res.status(200).json({
    success: true,
    message: "Artist patched successfully.",
    artist: updated,
  });
});

/**
 * PATCH /api/admin/artists/:id/approve
 */
router.patch("/:id/approve", (req, res) => {
  const id = safeText(req.params?.id);
  const existing = storeGet(id);

  if (!existing) {
    return res.status(404).json({ success: false, message: "Artist not found.", id });
  }

  const updated = storePatch(id, { status: "active" });

  return res.status(200).json({
    success: true,
    message: "Artist approved.",
    artist: updated,
  });
});

/**
 * PATCH /api/admin/artists/:id/reject
 */
router.patch("/:id/reject", (req, res) => {
  const id = safeText(req.params?.id);
  const existing = storeGet(id);

  if (!existing) {
    return res.status(404).json({ success: false, message: "Artist not found.", id });
  }

  const updated = storePatch(id, { status: "rejected" });

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
  const id = safeText(req.params?.id);
  const existing = storeGet(id);

  if (!existing) {
    return res.status(404).json({ success: false, message: "Artist not found.", id });
  }

  const deleted = storeDelete(id);

  return res.status(200).json({
    success: true,
    message: "Artist deleted successfully.",
    deleted,
  });
});

export default router;