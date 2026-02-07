// adminArtists.js (ESM)
// Admin artists control API — aligned with artistsStore.js
//
// Mounted at: /api/admin/artists
//
// Supports:
// - list (with status filtering)
// - get by id
// - create
// - put (replace)
// - patch (partial)  ✅ uses patchArtist() for true partial updates
// - delete
// - seed endpoints (MVP momentum):
//    POST /api/admin/artists/seed/demo
//    POST /api/admin/artists/seed/bad-bunny
//    POST /api/admin/artists/seed/reset-demo-only

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
    status: isNonEmptyString(body.status) ? body.status.trim().toLowerCase() : undefined,
    votes: body.votes !== undefined ? Number(body.votes) : undefined,
  };
}

function stripUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function normalizeStatusQuery(v) {
  const s = asString(v).toLowerCase();
  if (!s) return "";
  if (["pending", "active", "rejected"].includes(s)) return s;
  if (["all", "*"].includes(s)) return "all";
  return "";
}

function pickStoreFn(name, fallbackName) {
  if (artistsStore && typeof artistsStore[name] === "function") return artistsStore[name].bind(artistsStore);
  if (artistsStore && typeof artistsStore[fallbackName] === "function") return artistsStore[fallbackName].bind(artistsStore);
  return null;
}

// Store functions (supports both object default and named exports in artistsStore.js)
const storeList =
  pickStoreFn("listArtists", "getAll") ||
  (() => []);

const storeGet =
  pickStoreFn("getArtist", "getById") ||
  (() => null);

const storeCreate =
  pickStoreFn("createArtist", "create") ||
  (() => null);

const storeUpdate =
  pickStoreFn("updateArtist", "update") ||
  (() => null);

const storePatch =
  pickStoreFn("patchArtist", "patch") ||
  null;

const storeDelete =
  pickStoreFn("deleteArtist", "remove") ||
  (() => null);

/* -------------------- Routes -------------------- */

/**
 * POST /api/admin/artists/seed/demo
 * Ensures demo exists (id="demo") without duplicating it.
 */
router.post("/seed/demo", (_req, res) => {
  const all = storeList();
  const existing = Array.isArray(all) ? all.find((a) => asString(a?.id) === "demo") : null;

  if (existing) {
    return res.status(200).json({
      success: true,
      message: "Demo already exists.",
      artist: existing,
    });
  }

  const created = storeCreate({
    id: "demo",
    name: "Demo Artist",
    genre: "Pop / Urban",
    location: "London, UK",
    bio: "Demo artist used for initial platform validation.",
    imageUrl: "",
    socials: { instagram: "", tiktok: "", youtube: "", spotify: "", soundcloud: "", website: "" },
    tracks: [{ title: "Demo Track", url: "", platform: "mp3", durationSec: 30 }],
    votes: 42,
    status: "active",
    source: "seed",
  });

  return res.status(201).json({
    success: true,
    message: "Demo seeded.",
    artist: created,
  });
});

/**
 * POST /api/admin/artists/seed/bad-bunny
 * One-click invite/seed for MVP.
 * This is NOT identity verification — it’s just demo data to validate flow.
 */
router.post("/seed/bad-bunny", (_req, res) => {
  const id = "bad-bunny";
  const all = storeList();
  const existing = Array.isArray(all) ? all.find((a) => asString(a?.id) === id) : null;

  if (existing) {
    return res.status(200).json({
      success: true,
      message: "Bad Bunny already exists.",
      artist: existing,
    });
  }

  const created = storeCreate({
    id,
    name: "Bad Bunny",
    genre: "Latin / Reggaeton",
    location: "Puerto Rico",
    bio: "Global superstar ready for signing.",
    imageUrl: "",
    socials: {
      instagram: "https://www.instagram.com/badbunnypr/",
      tiktok: "",
      youtube: "",
      spotify: "",
      soundcloud: "",
      website: "",
    },
    tracks: [
      {
        title: "Tití Me Preguntó",
        url: "https://www.youtube.com/watch?v=Cr8K88UcO0s",
        platform: "YouTube",
        durationSec: 210,
      },
    ],
    votes: 0,
    status: "active",
    source: "seed",
  });

  return res.status(201).json({
    success: true,
    message: "Bad Bunny seeded.",
    artist: created,
  });
});

/**
 * POST /api/admin/artists/seed/reset-demo-only
 * MVP helper: wipes everything then re-seeds demo only.
 */
router.post("/seed/reset-demo-only", (_req, res) => {
  const reset = pickStoreFn("resetArtists", "reset");
  if (!reset) {
    return res.status(501).json({
      success: false,
      message: "Reset not supported by store.",
    });
  }

  const deletedCount = reset();
  const all = storeList();
  const demo = Array.isArray(all) ? all.find((a) => asString(a?.id) === "demo") : null;

  return res.status(200).json({
    success: true,
    message: "Reset complete (demo only).",
    deletedCount,
    demo,
  });
});

/**
 * GET /api/admin/artists
 * Optional query:
 *  - status=pending|active|rejected|all
 */
router.get("/", (req, res) => {
  const status = normalizeStatusQuery(req.query?.status) || "all";

  const artists = storeList();
  const list = Array.isArray(artists) ? artists : [];

  const filtered =
    status === "all"
      ? list
      : list.filter((a) => asString(a?.status).toLowerCase() === status);

  return res.status(200).json({
    success: true,
    count: filtered.length,
    artists: filtered,
    status,
  });
});

/**
 * GET /api/admin/artists/:id
 */
router.get("/:id", (req, res) => {
  const artist = storeGet(req.params.id);
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
  const existing = storeGet(req.params.id);
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

  const updated = storeUpdate(req.params.id, {
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
 * Partial update ✅ uses patchArtist() so status changes persist cleanly
 */
router.patch("/:id", (req, res) => {
  const existing = storeGet(req.params.id);
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
    status: payload.status,
    votes: Number.isFinite(payload.votes) ? payload.votes : undefined,
  });

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({
      success: false,
      message: "No valid fields provided to update.",
    });
  }

  // Prefer storePatch (true partial). Fallback to storeUpdate if needed.
  const updated = storePatch
    ? storePatch(req.params.id, patch)
    : storeUpdate(req.params.id, { ...existing, ...patch });

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
  const existing = storeGet(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "Artist not found." });
  }

  const deleted = storeDelete(req.params.id);

  return res.status(200).json({
    success: true,
    message: "Artist deleted successfully.",
    deleted,
  });
});

export default router;