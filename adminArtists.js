// adminArtists.js (ESM)
// Admin artists control API — aligned with artistsStore.js
//
// Mounted at: /api/admin/artists
//
// Supports (future-proof, winning pattern):
// - list (with status filtering)
// - get by id
// - create
// - put (replace)
// - patch (partial) ✅ uses patchArtist() for true partial updates when available
// - delete
// - admin actions (the missing part you hit):
//    PATCH /api/admin/artists/:id/approve   (pending -> active)
//    PATCH /api/admin/artists/:id/reject    (pending -> rejected)
//    PATCH /api/admin/artists/:id/suspend   (active -> suspended)
//    PATCH /api/admin/artists/:id/unsuspend (suspended -> active)
//    PATCH /api/admin/artists/:id/status    (set status safely)
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

function toInt(v, fallback = 0) {
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}

function stripUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function normalizeStatus(v) {
  const s = asString(v).toLowerCase();
  if (!s) return undefined;
  return s;
}

function normalizeStatusQuery(v) {
  const s = asString(v).toLowerCase();
  if (!s) return "";
  if (["pending", "active", "rejected", "suspended"].includes(s)) return s;
  if (["all", "*"].includes(s)) return "all";
  return "";
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

function pickStoreFn(name, fallbackName) {
  if (artistsStore && typeof artistsStore[name] === "function") return artistsStore[name].bind(artistsStore);
  if (artistsStore && typeof artistsStore[fallbackName] === "function") return artistsStore[fallbackName].bind(artistsStore);
  return null;
}

// Store functions (supports both object default and named exports in artistsStore.js)
const storeList = pickStoreFn("listArtists", "getAll") || (() => []);
const storeGet = pickStoreFn("getArtist", "getById") || (() => null);
const storeCreate = pickStoreFn("createArtist", "create") || (() => null);
const storeUpdate = pickStoreFn("updateArtist", "update") || (() => null);
const storePatch = pickStoreFn("patchArtist", "patch") || null;
const storeDelete = pickStoreFn("deleteArtist", "remove") || (() => null);

function applyPatch(id, patch) {
  // Prefer true partial patch
  if (storePatch) return storePatch(id, patch);

  // Fallback: merge then update
  const existing = storeGet(id);
  if (!existing) return null;
  return storeUpdate(id, { ...existing, ...patch });
}

function notFound(res, id) {
  return res.status(404).json({
    success: false,
    message: "Artist not found.",
    id: asString(id),
  });
}

function badRequest(res, message, extra = {}) {
  return res.status(400).json({
    success: false,
    message,
    ...extra,
  });
}

function ok(res, payload) {
  return res.status(200).json(payload);
}

function created(res, payload) {
  return res.status(201).json(payload);
}

/* -------------------- Seed Routes -------------------- */

/**
 * POST /api/admin/artists/seed/demo
 * Ensures demo exists (id="demo") without duplicating it.
 */
router.post("/seed/demo", (_req, res) => {
  const all = storeList();
  const existing = Array.isArray(all) ? all.find((a) => asString(a?.id) === "demo") : null;

  if (existing) {
    return ok(res, {
      success: true,
      message: "Demo already exists.",
      artist: existing,
    });
  }

  const createdArtist = storeCreate({
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

  return created(res, {
    success: true,
    message: "Demo seeded.",
    artist: createdArtist,
  });
});

/**
 * POST /api/admin/artists/seed/bad-bunny
 * One-click seed for MVP validation.
 */
router.post("/seed/bad-bunny", (_req, res) => {
  const id = "bad-bunny";
  const all = storeList();
  const existing = Array.isArray(all) ? all.find((a) => asString(a?.id) === id) : null;

  if (existing) {
    return ok(res, {
      success: true,
      message: "Bad Bunny already exists.",
      artist: existing,
    });
  }

  const createdArtist = storeCreate({
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

  return created(res, {
    success: true,
    message: "Bad Bunny seeded.",
    artist: createdArtist,
  });
});

/**
 * POST /api/admin/artists/seed/reset-demo-only
 * MVP helper: wipes everything then re-seeds demo only (if the store supports reset)
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

  return ok(res, {
    success: true,
    message: "Reset complete (demo only).",
    deletedCount,
    demo,
  });
});

/* -------------------- List / Get -------------------- */

/**
 * GET /api/admin/artists
 * Optional query:
 *  - status=pending|active|rejected|suspended|all
 */
router.get("/", (req, res) => {
  const status = normalizeStatusQuery(req.query?.status) || "all";

  const artists = storeList();
  const list = Array.isArray(artists) ? artists : [];

  const filtered =
    status === "all"
      ? list
      : list.filter((a) => asString(a?.status).toLowerCase() === status);

  return ok(res, {
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
  const id = asString(req.params.id);
  const artist = storeGet(id);

  if (!artist) return notFound(res, id);

  return ok(res, { success: true, artist });
});

/* -------------------- Admin Actions (the missing endpoints) -------------------- */

const ALLOWED_STATUSES = new Set(["pending", "active", "rejected", "suspended"]);

function canTransition(from, to) {
  // Safe defaults. We can loosen later if needed.
  if (from === to) return true;

  const allowed = new Set([
    "pending->active",
    "pending->rejected",
    "active->suspended",
    "suspended->active",
    // admin override route /status can still set other transitions if we allow it later
  ]);

  return allowed.has(`${from}->${to}`);
}

/**
 * PATCH /api/admin/artists/:id/approve
 * pending -> active
 */
router.patch("/:id/approve", (req, res) => {
  const id = asString(req.params.id);
  const existing = storeGet(id);
  if (!existing) return notFound(res, id);

  const from = asString(existing.status).toLowerCase() || "active";
  const to = "active";

  if (!canTransition(from, to)) {
    return badRequest(res, "Invalid status transition.", { id, from, to });
  }

  const updated = applyPatch(id, { status: to });

  return ok(res, {
    success: true,
    message: "Artist approved.",
    id,
    from,
    to,
    artist: updated,
  });
});

/**
 * PATCH /api/admin/artists/:id/reject
 * pending -> rejected
 */
router.patch("/:id/reject", (req, res) => {
  const id = asString(req.params.id);
  const existing = storeGet(id);
  if (!existing) return notFound(res, id);

  const from = asString(existing.status).toLowerCase() || "active";
  const to = "rejected";

  if (!canTransition(from, to)) {
    return badRequest(res, "Invalid status transition.", { id, from, to });
  }

  const updated = applyPatch(id, { status: to });

  return ok(res, {
    success: true,
    message: "Artist rejected.",
    id,
    from,
    to,
    artist: updated,
  });
});

/**
 * PATCH /api/admin/artists/:id/suspend
 * active -> suspended
 */
router.patch("/:id/suspend", (req, res) => {
  const id = asString(req.params.id);
  const existing = storeGet(id);
  if (!existing) return notFound(res, id);

  const from = asString(existing.status).toLowerCase() || "active";
  const to = "suspended";

  if (!canTransition(from, to)) {
    return badRequest(res, "Invalid status transition.", { id, from, to });
  }

  const updated = applyPatch(id, { status: to });

  return ok(res, {
    success: true,
    message: "Artist suspended.",
    id,
    from,
    to,
    artist: updated,
  });
});

/**
 * PATCH /api/admin/artists/:id/unsuspend
 * suspended -> active
 */
router.patch("/:id/unsuspend", (req, res) => {
  const id = asString(req.params.id);
  const existing = storeGet(id);
  if (!existing) return notFound(res, id);

  const from = asString(existing.status).toLowerCase() || "active";
  const to = "active";

  if (!canTransition(from, to)) {
    return badRequest(res, "Invalid status transition.", { id, from, to });
  }

  const updated = applyPatch(id, { status: to });

  return ok(res, {
    success: true,
    message: "Artist unsuspended.",
    id,
    from,
    to,
    artist: updated,
  });
});

/**
 * PATCH /api/admin/artists/:id/status
 * Admin-safe status setter (future-proof).
 * Body: { "status": "pending|active|rejected|suspended" }
 */
router.patch("/:id/status", (req, res) => {
  const id = asString(req.params.id);
  const existing = storeGet(id);
  if (!existing) return notFound(res, id);

  const requested = normalizeStatus(req.body?.status);

  if (!requested || !ALLOWED_STATUSES.has(requested)) {
    return badRequest(res, "Invalid status. Allowed: pending, active, rejected, suspended.", {
      id,
      allowed: Array.from(ALLOWED_STATUSES),
    });
  }

  const from = asString(existing.status).toLowerCase() || "active";
  const to = requested;

  // Keep it safe by default; if you want full admin override later, we can add ?force=1
  if (!canTransition(from, to)) {
    return badRequest(res, "Invalid status transition.", { id, from, to });
  }

  const updated = applyPatch(id, { status: to });

  return ok(res, {
    success: true,
    message: "Status updated.",
    id,
    from,
    to,
    artist: updated,
  });
});

/* -------------------- CRUD -------------------- */

/**
 * POST /api/admin/artists
 * Create new artist (requires name)
 */
router.post("/", (req, res) => {
  const payload = normalizeArtistPayload(req.body);

  if (!payload.name) {
    return badRequest(res, "Validation error: 'name' is required.");
  }

  const createdArtist = storeCreate(
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
      votes: Number.isFinite(payload.votes) ? toInt(payload.votes, 0) : 0,
    })
  );

  return created(res, {
    success: true,
    message: "Artist created successfully.",
    artist: createdArtist,
  });
});

/**
 * PUT /api/admin/artists/:id
 * Replace full artist (requires name)
 */
router.put("/:id", (req, res) => {
  const id = asString(req.params.id);
  const existing = storeGet(id);
  if (!existing) return notFound(res, id);

  const payload = normalizeArtistPayload(req.body);

  if (!payload.name) {
    return badRequest(res, "Validation error: 'name' is required.");
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
    votes: Number.isFinite(payload.votes) ? toInt(payload.votes, existing.votes ?? 0) : existing.votes,
  });

  return ok(res, {
    success: true,
    message: "Artist updated successfully.",
    artist: updated,
  });
});

/**
 * PATCH /api/admin/artists/:id
 * Partial update ✅ uses patchArtist() so changes persist cleanly
 */
router.patch("/:id", (req, res) => {
  const id = asString(req.params.id);
  const existing = storeGet(id);
  if (!existing) return notFound(res, id);

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
    votes: Number.isFinite(payload.votes) ? toInt(payload.votes, 0) : undefined,
  });

  if (Object.keys(patch).length === 0) {
    return badRequest(res, "No valid fields provided to update.");
  }

  // If they try setting status here, keep it safe/consistent with admin rules
  if (patch.status) {
    const from = asString(existing.status).toLowerCase() || "active";
    const to = asString(patch.status).toLowerCase();
    if (!ALLOWED_STATUSES.has(to)) {
      return badRequest(res, "Invalid status. Allowed: pending, active, rejected, suspended.", {
        id,
        allowed: Array.from(ALLOWED_STATUSES),
      });
    }
    if (!canTransition(from, to)) {
      return badRequest(res, "Invalid status transition.", { id, from, to });
    }
  }

  const updated = applyPatch(id, patch);

  return ok(res, {
    success: true,
    message: "Artist patched successfully.",
    artist: updated,
  });
});

/**
 * DELETE /api/admin/artists/:id
 */
router.delete("/:id", (req, res) => {
  const id = asString(req.params.id);
  const existing = storeGet(id);
  if (!existing) return notFound(res, id);

  const deleted = storeDelete(id);

  return ok(res, {
    success: true,
    message: "Artist deleted successfully.",
    deleted,
  });
});

export default router;