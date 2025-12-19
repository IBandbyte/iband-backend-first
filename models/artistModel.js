/**
 * iBand — Artist Model (framework-agnostic)
 * ----------------------------------------
 * Purpose:
 * - Single source of truth for Artist shape + validation + normalization
 * - Works today with in-memory storage (no DB required)
 * - Future-proof: easy to swap storage layer while keeping contract stable
 *
 * Notes:
 * - This file does NOT depend on Express.
 * - Routes (artists.js) should import functions from here.
 */

import crypto from "crypto";

/** ---------- Utilities ---------- */

function uuid() {
  // Node 18+ usually supports crypto.randomUUID()
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

  // Fallback (RFC4122-ish) if randomUUID isn't available
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (crypto.randomBytes(1)[0] % 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function nowISO() {
  return new Date().toISOString();
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function toTrimmedString(v) {
  return typeof v === "string" ? v.trim() : "";
}

function toLowerTrim(v) {
  return toTrimmedString(v).toLowerCase();
}

function clampNumber(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

function asStringArray(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string") {
    // allow comma-separated strings
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function safeUrlOrEmpty(v) {
  const s = toTrimmedString(v);
  if (!s) return "";
  try {
    const u = new URL(s);
    return u.toString();
  } catch {
    return "";
  }
}

/** ---------- Public Error Helpers ---------- */

export function createValidationError(message, fields = {}) {
  const err = new Error(message || "Validation error");
  err.status = 400;
  err.code = "VALIDATION_ERROR";
  err.fields = fields;
  return err;
}

export function createNotFoundError(message) {
  const err = new Error(message || "Not found");
  err.status = 404;
  err.code = "NOT_FOUND";
  return err;
}

/** ---------- Artist Shape ---------- */
/**
 * Artist (public fields)
 * id: string (uuid)
 * name: string (required)
 * slug: string (derived)
 * genres: string[]
 * location: string
 * bio: string
 * avatarUrl: string (url)
 * socials: { instagram?, tiktok?, youtube?, spotify?, soundcloud?, website? }
 * tracks: Array<{ title, url, platform, durationSec? }>
 * status: "active" | "pending" | "hidden"
 * stats: { votes: number }
 * createdAt: ISO string
 * updatedAt: ISO string
 */

/** ---------- Normalization + Validation ---------- */

function slugify(name) {
  const base = toLowerTrim(name)
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `artist-${uuid().slice(0, 8)}`;
}

function normalizeSocials(input) {
  const obj = input && typeof input === "object" ? input : {};
  return {
    instagram: safeUrlOrEmpty(obj.instagram),
    tiktok: safeUrlOrEmpty(obj.tiktok),
    youtube: safeUrlOrEmpty(obj.youtube),
    spotify: safeUrlOrEmpty(obj.spotify),
    soundcloud: safeUrlOrEmpty(obj.soundcloud),
    website: safeUrlOrEmpty(obj.website),
  };
}

function normalizeTracks(input) {
  const arr = Array.isArray(input) ? input : [];
  return arr
    .map((t) => {
      const title = toTrimmedString(t?.title);
      const url = safeUrlOrEmpty(t?.url);
      const platform = toTrimmedString(t?.platform);
      const durationSec =
        t?.durationSec == null ? undefined : clampNumber(t.durationSec, 0, 60 * 60);

      if (!title || !url) return null;
      return {
        title,
        url,
        platform: platform || "unknown",
        ...(durationSec !== undefined ? { durationSec } : {}),
      };
    })
    .filter(Boolean);
}

function normalizeStatus(v) {
  const s = toLowerTrim(v);
  if (s === "pending" || s === "hidden" || s === "active") return s;
  return "active";
}

export function normalizeArtistCreate(payload) {
  const fields = {};

  const name = toTrimmedString(payload?.name);
  if (!name) fields.name = "Name is required";

  const genres = asStringArray(payload?.genres).slice(0, 10);
  const location = toTrimmedString(payload?.location);
  const bio = toTrimmedString(payload?.bio);
  const avatarUrl = safeUrlOrEmpty(payload?.avatarUrl);

  const socials = normalizeSocials(payload?.socials);
  const tracks = normalizeTracks(payload?.tracks);
  const status = normalizeStatus(payload?.status);

  if (Object.keys(fields).length) {
    throw createValidationError("Invalid artist payload", fields);
  }

  const createdAt = nowISO();

  return {
    id: uuid(),
    name,
    slug: slugify(name),
    genres,
    location,
    bio,
    avatarUrl,
    socials,
    tracks,
    status,
    stats: { votes: 0 },
    createdAt,
    updatedAt: createdAt,
  };
}

export function normalizeArtistUpdate(existing, payload) {
  if (!existing) throw createNotFoundError("Artist not found");

  const fields = {};

  // Only update provided fields
  const name = payload?.name !== undefined ? toTrimmedString(payload.name) : existing.name;
  if (!name) fields.name = "Name cannot be empty";

  const genres =
    payload?.genres !== undefined
      ? asStringArray(payload.genres).slice(0, 10)
      : existing.genres;

  const location =
    payload?.location !== undefined ? toTrimmedString(payload.location) : existing.location;

  const bio = payload?.bio !== undefined ? toTrimmedString(payload.bio) : existing.bio;

  const avatarUrl =
    payload?.avatarUrl !== undefined ? safeUrlOrEmpty(payload.avatarUrl) : existing.avatarUrl;

  const socials =
    payload?.socials !== undefined ? normalizeSocials(payload.socials) : existing.socials;

  const tracks =
    payload?.tracks !== undefined ? normalizeTracks(payload.tracks) : existing.tracks;

  const status =
    payload?.status !== undefined ? normalizeStatus(payload.status) : existing.status;

  if (Object.keys(fields).length) {
    throw createValidationError("Invalid artist update payload", fields);
  }

  const updatedAt = nowISO();

  return {
    ...existing,
    name,
    slug: existing.slug || slugify(name),
    genres,
    location,
    bio,
    avatarUrl,
    socials,
    tracks,
    status,
    updatedAt,
  };
}

/** ---------- In-Memory Store (swap later for DB) ---------- */

const _store = new Map(); // id -> artist

export function seedArtists(list = []) {
  // Accept either already-normalized artists OR raw create payloads
  for (const item of list) {
    const artist = item?.id && item?.createdAt ? item : normalizeArtistCreate(item);
    _store.set(artist.id, artist);
  }
  return listArtists({ limit: 1000 });
}

export function clearArtists() {
  _store.clear();
}

export function createArtist(payload) {
  const artist = normalizeArtistCreate(payload);
  _store.set(artist.id, artist);
  return artist;
}

export function getArtistById(id) {
  const key = String(id || "");
  const a = _store.get(key);
  if (!a) throw createNotFoundError("Artist not found");
  return a;
}

export function updateArtist(id, payload) {
  const key = String(id || "");
  const existing = _store.get(key);
  if (!existing) throw createNotFoundError("Artist not found");
  const updated = normalizeArtistUpdate(existing, payload);
  _store.set(key, updated);
  return updated;
}

export function deleteArtist(id) {
  const key = String(id || "");
  const existing = _store.get(key);
  if (!existing) throw createNotFoundError("Artist not found");
  _store.delete(key);
  return { deleted: true, id: key };
}

export function incrementArtistVotes(id, amount = 1) {
  const key = String(id || "");
  const existing = _store.get(key);
  if (!existing) throw createNotFoundError("Artist not found");

  const inc = clampNumber(amount, -1000000, 1000000);
  const nextVotes = clampNumber((existing?.stats?.votes ?? 0) + inc, 0, 1000000000);

  const updated = {
    ...existing,
    stats: { ...(existing.stats || {}), votes: nextVotes },
    updatedAt: nowISO(),
  };

  _store.set(key, updated);
  return updated;
}

/**
 * List artists with basic search + paging + sorting.
 * query:
 *  - q: string (search name/genre/location)
 *  - genre: string
 *  - status: active|pending|hidden|all
 *  - sort: "new" | "votes" | "name"
 *  - order: "asc" | "desc"
 *  - page: number (1-based)
 *  - limit: number (max 50)
 */
export function listArtists(query = {}) {
  const q = toLowerTrim(query.q);
  const genre = toLowerTrim(query.genre);
  const statusRaw = toLowerTrim(query.status);
  const status = statusRaw === "all" ? "all" : normalizeStatus(statusRaw || "active");

  const sort = toLowerTrim(query.sort) || "new";
  const order = toLowerTrim(query.order) === "asc" ? "asc" : "desc";

  const page = clampNumber(query.page ?? 1, 1, 1000000);
  const limit = clampNumber(query.limit ?? 20, 1, 50);
  const offset = (page - 1) * limit;

  let items = Array.from(_store.values());

  // status filter
  if (status !== "all") {
    items = items.filter((a) => (a.status || "active") === status);
  }

  // genre filter
  if (genre) {
    items = items.filter((a) =>
      Array.isArray(a.genres)
        ? a.genres.some((g) => toLowerTrim(g) === genre)
        : false
    );
  }

  // q search across name/genres/location
  if (q) {
    items = items.filter((a) => {
      const name = toLowerTrim(a.name);
      const loc = toLowerTrim(a.location);
      const genresText = (a.genres || []).map((g) => toLowerTrim(g)).join(" ");
      return name.includes(q) || loc.includes(q) || genresText.includes(q);
    });
  }

  // sort
  items.sort((a, b) => {
    if (sort === "votes") {
      const av = Number(a?.stats?.votes ?? 0);
      const bv = Number(b?.stats?.votes ?? 0);
      return order === "asc" ? av - bv : bv - av;
    }
    if (sort === "name") {
      const an = toLowerTrim(a.name);
      const bn = toLowerTrim(b.name);
      if (an < bn) return order === "asc" ? -1 : 1;
      if (an > bn) return order === "asc" ? 1 : -1;
      return 0;
    }

    // default: new (createdAt)
    const at = Date.parse(a.createdAt || 0) || 0;
    const bt = Date.parse(b.createdAt || 0) || 0;
    return order === "asc" ? at - bt : bt - at;
  });

  const total = items.length;
  const paged = items.slice(offset, offset + limit);

  return {
    page,
    limit,
    total,
    items: paged,
  };
}

/** Optional: return the public shape (in case we add private fields later). */
export function toPublicArtist(artist) {
  if (!artist) return null;
  const {
    id,
    name,
    slug,
    genres,
    location,
    bio,
    avatarUrl,
    socials,
    tracks,
    status,
    stats,
    createdAt,
    updatedAt,
  } = artist;

  return {
    id,
    name,
    slug,
    genres,
    location,
    bio,
    avatarUrl,
    socials,
    tracks,
    status,
    stats,
    createdAt,
    updatedAt,
  };
}