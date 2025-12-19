 import express from "express";
import crypto from "crypto";

export const artistsRouter = express.Router();

/**
 * In-memory store (Phase 2.1)
 * Later we’ll swap this to a real DB without changing the API contract.
 */
const store = {
  artists: new Map(), // id -> artist
};

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return crypto.randomUUID();
}

function toNumber(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalizeString(v) {
  return typeof v === "string" ? v.trim() : "";
}

function safeUrl(v) {
  const s = normalizeString(v);
  if (!s) return "";
  return s;
}

function normalizeSocials(socials = {}) {
  return {
    instagram: safeUrl(socials.instagram),
    youtube: safeUrl(socials.youtube),
    spotify: safeUrl(socials.spotify),
    soundcloud: safeUrl(socials.soundcloud),
    tiktok: safeUrl(socials.tiktok),
    website: safeUrl(socials.website),
  };
}

function normalizeTracks(tracks = []) {
  if (!Array.isArray(tracks)) return [];
  return tracks
    .filter((t) => t && typeof t === "object")
    .map((t) => ({
      id: normalizeString(t.id) || newId(),
      title: normalizeString(t.title) || "Untitled Track",
      url: safeUrl(t.url),
      platform: normalizeString(t.platform) || "link",
      durationSec: clamp(toNumber(t.durationSec, 0), 0, 60 * 60),
    }))
    .filter((t) => t.url || t.title);
}

function normalizeArtistInput(body = {}) {
  const name = normalizeString(body.name);
  if (!name) {
    const err = new Error("Artist name is required");
    err.status = 400;
    throw err;
  }

  const artist = {
    name,
    genre: normalizeString(body.genre),
    location: normalizeString(body.location),
    bio: normalizeString(body.bio),
    avatarUrl: safeUrl(body.avatarUrl),
    bannerUrl: safeUrl(body.bannerUrl),
    socials: normalizeSocials(body.socials),
    tracks: normalizeTracks(body.tracks),
    status: normalizeString(body.status) || "active", // active | pending | blocked | deleted
  };

  return artist;
}

function serializeArtist(a) {
  return {
    id: a.id,
    name: a.name,
    genre: a.genre,
    location: a.location,
    bio: a.bio,
    avatarUrl: a.avatarUrl,
    bannerUrl: a.bannerUrl,
    socials: a.socials,
    tracks: a.tracks,
    status: a.status,
    votes: a.votes,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

/**
 * Seed: a single demo artist (keeps UI alive even if list empty)
 */
function ensureSeed() {
  if (store.artists.size > 0) return;

  const id = "demo";
  store.artists.set(id, {
    id,
    name: "Demo Artist",
    genre: "Pop / Urban",
    location: "London, UK",
    bio: "This is demo data. Next phase: real submissions + moderation + playback.",
    avatarUrl: "",
    bannerUrl: "",
    socials: normalizeSocials({
      instagram: "https://instagram.com/",
      youtube: "https://youtube.com/",
    }),
    tracks: normalizeTracks([
      {
        title: "Demo Track",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        platform: "mp3",
        durationSec: 30,
      },
    ]),
    status: "active",
    votes: 42,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
}

ensureSeed();

/**
 * GET /artists
 * Query:
 * - q (search name/genre/location)
 * - status
 * - sort: new | votes | name
 * - order: asc | desc
 * - page, limit
 */
artistsRouter.get("/", (req, res) => {
  const q = normalizeString(req.query.q).toLowerCase();
  const status = normalizeString(req.query.status).toLowerCase();

  const sort = normalizeString(req.query.sort).toLowerCase() || "new";
  const order = normalizeString(req.query.order).toLowerCase() || "desc";

  const page = clamp(toNumber(req.query.page, 1), 1, 9999);
  const limit = clamp(toNumber(req.query.limit, 20), 1, 100);

  let items = Array.from(store.artists.values());

  // Filter deleted unless explicitly requested
  if (!status) {
    items = items.filter((a) => a.status !== "deleted");
  } else {
    items = items.filter((a) => a.status.toLowerCase() === status);
  }

  if (q) {
    items = items.filter((a) => {
      const hay = `${a.name} ${a.genre} ${a.location}`.toLowerCase();
      return hay.includes(q);
    });
  }

  items.sort((a, b) => {
    let cmp = 0;
    if (sort === "votes") cmp = (a.votes || 0) - (b.votes || 0);
    else if (sort === "name") cmp = a.name.localeCompare(b.name);
    else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); // new

    return order === "asc" ? cmp : -cmp;
  });

  const total = items.length;
  const start = (page - 1) * limit;
  const paged = items.slice(start, start + limit).map(serializeArtist);

  res.json({
    success: true,
    data: paged,
    meta: {
      page,
      limit,
      total,
      hasMore: start + limit < total,
    },
  });
});

/**
 * GET /artists/demo (easy sanity check)
 */
artistsRouter.get("/demo", (req, res) => {
  const a = store.artists.get("demo");
  if (!a) {
    return res.status(404).json({ success: false, message: "Demo not found" });
  }
  return res.json({ success: true, data: serializeArtist(a) });
});

/**
 * POST /artists
 */
artistsRouter.post("/", (req, res) => {
  const input = normalizeArtistInput(req.body);

  const id = newId();
  const created = {
    id,
    ...input,
    votes: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  store.artists.set(id, created);

  res.status(201).json({
    success: true,
    data: serializeArtist(created),
  });
});

/**
 * GET /artists/:id
 */
artistsRouter.get("/:id", (req, res) => {
  const id = normalizeString(req.params.id);
  const a = store.artists.get(id);

  if (!a || a.status === "deleted") {
    return res.status(404).json({ success: false, message: "Artist not found" });
  }

  return res.json({ success: true, data: serializeArtist(a) });
});

/**
 * PUT /artists/:id (replace)
 */
artistsRouter.put("/:id", (req, res) => {
  const id = normalizeString(req.params.id);
  const existing = store.artists.get(id);

  if (!existing || existing.status === "deleted") {
    return res.status(404).json({ success: false, message: "Artist not found" });
  }

  const input = normalizeArtistInput(req.body);

  const updated = {
    ...existing,
    ...input,
    id,
    votes: existing.votes ?? 0,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
  };

  store.artists.set(id, updated);
  return res.json({ success: true, data: serializeArtist(updated) });
});

/**
 * PATCH /artists/:id (partial)
 */
artistsRouter.patch("/:id", (req, res) => {
  const id = normalizeString(req.params.id);
  const existing = store.artists.get(id);

  if (!existing || existing.status === "deleted") {
    return res.status(404).json({ success: false, message: "Artist not found" });
  }

  const body = req.body || {};

  const next = { ...existing };

  if (body.name !== undefined) next.name = normalizeString(body.name);
  if (!next.name) {
    return res.status(400).json({ success: false, message: "Artist name is required" });
  }

  if (body.genre !== undefined) next.genre = normalizeString(body.genre);
  if (body.location !== undefined) next.location = normalizeString(body.location);
  if (body.bio !== undefined) next.bio = normalizeString(body.bio);
  if (body.avatarUrl !== undefined) next.avatarUrl = safeUrl(body.avatarUrl);
  if (body.bannerUrl !== undefined) next.bannerUrl = safeUrl(body.bannerUrl);

  if (body.socials !== undefined) next.socials = normalizeSocials(body.socials);
  if (body.tracks !== undefined) next.tracks = normalizeTracks(body.tracks);

  if (body.status !== undefined) next.status = normalizeString(body.status) || next.status;

  next.updatedAt = nowIso();

  store.artists.set(id, next);
  return res.json({ success: true, data: serializeArtist(next) });
});

/**
 * DELETE /artists/:id (soft delete)
 */
artistsRouter.delete("/:id", (req, res) => {
  const id = normalizeString(req.params.id);
  const existing = store.artists.get(id);

  if (!existing || existing.status === "deleted") {
    return res.status(404).json({ success: false, message: "Artist not found" });
  }

  const updated = { ...existing, status: "deleted", updatedAt: nowIso() };
  store.artists.set(id, updated);

  return res.json({ success: true, data: { id, status: "deleted" } });
});

/**
 * POST /artists/:id/votes
 * Body: { amount?: number }
 */
artistsRouter.post("/:id/votes", (req, res) => {
  const id = normalizeString(req.params.id);
  const existing = store.artists.get(id);

  if (!existing || existing.status === "deleted") {
    return res.status(404).json({ success: false, message: "Artist not found" });
  }

  const amount = clamp(toNumber(req.body?.amount, 1), 1, 100);
  const votes = clamp((existing.votes ?? 0) + amount, 0, 1_000_000_000);

  const updated = { ...existing, votes, updatedAt: nowIso() };
  store.artists.set(id, updated);

  return res.json({ success: true, data: { artistId: id, votes } });
});

/**
 * GET /artists/:id/votes
 */
artistsRouter.get("/:id/votes", (req, res) => {
  const id = normalizeString(req.params.id);
  const existing = store.artists.get(id);

  if (!existing || existing.status === "deleted") {
    return res.status(404).json({ success: false, message: "Artist not found" });
  }

  return res.json({ success: true, data: { artistId: id, votes: existing.votes ?? 0 } });
});