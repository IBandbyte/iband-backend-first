// adminArtists.js (ESM)
// Admin artists control API — aligned with artistsStore.js
//
// Mounted at: /api/admin/artists
//
// Supports:
// - list (with status/q/page/limit like public API)
// - get by id
// - create
// - put (replace)
// - patch (partial, safe nested merge)
// - delete
// - approve / reject (routes used by frontend Admin UI)

import express from "express";
import artistsStore from "./artistsStore.js";

const router = express.Router();

/* -------------------- Helpers -------------------- */

const safeText = (v) => (v === null || v === undefined ? "" : String(v)).trim();

const toNumber = (v, fallback = 0) => {
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

function stripUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function buildSocialsPatch(rawSocials) {
  if (!rawSocials || typeof rawSocials !== "object") return undefined;

  const next = stripUndefined({
    instagram: rawSocials.instagram !== undefined ? safeText(rawSocials.instagram) : undefined,
    tiktok: rawSocials.tiktok !== undefined ? safeText(rawSocials.tiktok) : undefined,
    youtube: rawSocials.youtube !== undefined ? safeText(rawSocials.youtube) : undefined,
    spotify: rawSocials.spotify !== undefined ? safeText(rawSocials.spotify) : undefined,
    soundcloud: rawSocials.soundcloud !== undefined ? safeText(rawSocials.soundcloud) : undefined,
    website: rawSocials.website !== undefined ? safeText(rawSocials.website) : undefined,
  });

  return Object.keys(next).length ? next : undefined;
}

/* -------------------- Routes -------------------- */

/**
 * GET /api/admin/artists?status=all|active|pending|rejected&q=&page=&limit=
 * (Admin list supports filters + pagination)
 */
router.get("/", (req, res) => {
  const status = normalizeStatus(req.query?.status) || "all";
  const q = safeText(req.query?.q || req.query?.query || "");
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
  const id = safeText(req.params?.id);
  const artist = artistsStore.getArtist(id);
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
  const body = req.body && typeof req.body === "object" ? req.body : {};

  const name = safeText(body.name);
  if (!name) {
    return res.status(400).json({
      success: false,
      message: "Validation error: 'name' is required.",
    });
  }

  const created = artistsStore.createArtist(
    stripUndefined({
      id: body.id !== undefined ? safeText(body.id) : undefined,
      name,
      genre: body.genre !== undefined ? safeText(body.genre) : "Unknown",
      location: body.location !== undefined ? safeText(body.location) : "",
      bio: body.bio !== undefined ? safeText(body.bio) : "",
      imageUrl: body.imageUrl !== undefined ? safeText(body.imageUrl) : "",
      socials: buildSocialsPatch(body.socials) || {},
      tracks: Array.isArray(body.tracks) ? body.tracks : [],
      status: body.status !== undefined ? safeText(body.status) : "active",
      votes: body.votes !== undefined ? toNumber(body.votes, 0) : 0,
      source: body.source !== undefined ? safeText(body.source) : "admin",
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
  const existing = artistsStore.getArtist(id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "Artist not found." });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const name = safeText(body.name);

  if (!name) {
    return res.status(400).json({
      success: false,
      message: "Validation error: 'name' is required.",
    });
  }

  const updated = artistsStore.updateArtist(id, {
    name,
    genre: body.genre !== undefined ? safeText(body.genre) : "Unknown",
    location: body.location !== undefined ? safeText(body.location) : "",
    bio: body.bio !== undefined ? safeText(body.bio) : "",
    imageUrl: body.imageUrl !== undefined ? safeText(body.imageUrl) : "",
    socials: buildSocialsPatch(body.socials) || {},
    tracks: Array.isArray(body.tracks) ? body.tracks : [],
    status: body.status !== undefined ? safeText(body.status) : existing.status,
    votes: body.votes !== undefined ? toNumber(body.votes, existing.votes) : existing.votes,
  });

  return res.status(200).json({
    success: true,
    message: "Artist updated successfully.",
    artist: updated,
  });
});

/**
 * PATCH /api/admin/artists/:id
 * Partial update (safe nested merge)
 */
router.patch("/:id", (req, res) => {
  const id = safeText(req.params?.id);
  const existing = artistsStore.getArtist(id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "Artist not found." });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};

  const patch = stripUndefined({
    name: body.name !== undefined ? safeText(body.name) : undefined,
    genre: body.genre !== undefined ? safeText(body.genre) : undefined,
    location: body.location !== undefined ? safeText(body.location) : undefined,
    bio: body.bio !== undefined ? safeText(body.bio) : undefined,
    imageUrl: body.imageUrl !== undefined ? safeText(body.imageUrl) : undefined,
    socials: buildSocialsPatch(body.socials),
    tracks: body.tracks !== undefined ? (Array.isArray(body.tracks) ? body.tracks : undefined) : undefined,
    status: body.status !== undefined ? safeText(body.status) : undefined,
    votes: body.votes !== undefined ? toNumber(body.votes, existing.votes) : undefined,
  });

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({
      success: false,
      message: "No valid fields provided to update.",
    });
  }

  // Prefer patchArtist if store supports it (preserves nested socials properly)
  const updated =
    typeof artistsStore.patchArtist === "function"
      ? artistsStore.patchArtist(id, patch)
      : artistsStore.updateArtist(id, { ...existing, ...patch });

  return res.status(200).json({
    success: true,
    message: "Artist patched successfully.",
    artist: updated,
  });
});

/**
 * PATCH /api/admin/artists/:id/approve
 * Sets status = active
 */
router.patch("/:id/approve", (req, res) => {
  const id = safeText(req.params?.id);
  const existing = artistsStore.getArtist(id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "Artist not found." });
  }

  const note = safeText(req.body?.note || req.query?.note || "");

  const updated =
    typeof artistsStore.patchArtist === "function"
      ? artistsStore.patchArtist(id, { status: "active", adminNote: note })
      : artistsStore.updateArtist(id, { ...existing, status: "active", adminNote: note });

  return res.status(200).json({
    success: true,
    message: "Artist approved.",
    artist: updated,
  });
});

/**
 * PATCH /api/admin/artists/:id/reject
 * Sets status = rejected
 */
router.patch("/:id/reject", (req, res) => {
  const id = safeText(req.params?.id);
  const existing = artistsStore.getArtist(id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "Artist not found." });
  }

  const note = safeText(req.body?.note || req.query?.note || "");

  const updated =
    typeof artistsStore.patchArtist === "function"
      ? artistsStore.patchArtist(id, { status: "rejected", adminNote: note })
      : artistsStore.updateArtist(id, { ...existing, status: "rejected", adminNote: note });

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
  const existing = artistsStore.getArtist(id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "Artist not found." });
  }

  const deleted = artistsStore.deleteArtist(id);

  return res.status(200).json({
    success: true,
    message: "Artist deleted successfully.",
    deleted,
  });
});

export default router;