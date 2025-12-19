// artists.js (root)
// ESM module. Exports: artistsRouter
import express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const artistsRouter = express.Router();

// ----------------------
// Config / Storage
// ----------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "artists.json");

// In-memory store (loaded from disk if present)
let artists = [];

// Ensure data folder exists
function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    // If filesystem is read-only in some environments, we still run in-memory safely.
  }
}

function loadFromDisk() {
  try {
    ensureDataDir();
    if (!fs.existsSync(DATA_FILE)) {
      artists = [];
      return;
    }
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) artists = parsed;
    else artists = [];
  } catch (e) {
    artists = [];
  }
}

function saveToDisk() {
  try {
    ensureDataDir();
    fs.writeFileSync(DATA_FILE, JSON.stringify(artists, null, 2), "utf8");
  } catch (e) {
    // Ignore disk failures and keep operating in-memory.
  }
}

// Load once at startup
loadFromDisk();

// ----------------------
// Helpers
// ----------------------
function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  return crypto.randomUUID();
}

function ok(res, data, meta) {
  const payload = { success: true, data };
  if (meta) payload.meta = meta;
  return res.status(200).json(payload);
}

function created(res, data) {
  return res.status(201).json({ success: true, data });
}

function badRequest(res, message, errors) {
  const payload = { success: false, message: message || "Bad request." };
  if (errors) payload.errors = errors;
  return res.status(400).json(payload);
}

function notFound(res, message) {
  return res.status(404).json({ success: false, message: message || "Not found." });
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function safeString(v, fallback = "") {
  return isNonEmptyString(v) ? v.trim() : fallback;
}

function toInt(v, fallback) {
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalizeStatus(v) {
  const s = String(v || "").toLowerCase().trim();
  if (["active", "pending", "disabled", "deleted"].includes(s)) return s;
  return "active";
}

function normalizeLinks(links) {
  const out = {
    instagram: "",
    youtube: "",
    spotify: "",
    soundcloud: "",
    tiktok: "",
    website: "",
  };
  if (links && typeof links === "object") {
    for (const k of Object.keys(out)) {
      if (isNonEmptyString(links[k])) out[k] = links[k].trim();
    }
  }
  return out;
}

function normalizeTracks(tracks) {
  if (!Array.isArray(tracks)) return [];
  return tracks
    .filter((t) => t && typeof t === "object")
    .map((t) => ({
      id: isNonEmptyString(t.id) ? t.id.trim() : makeId(),
      title: safeString(t.title, "Untitled Track"),
      url: safeString(t.url, ""),
      platform: safeString(t.platform, ""),
      durationSec: clamp(toInt(t.durationSec, 0), 0, 60 * 60),
      createdAt: isNonEmptyString(t.createdAt) ? t.createdAt : nowIso(),
    }));
}

function validateArtistInput(body, { partial = false } = {}) {
  const errors = [];

  // Required on create (not required on patch)
  if (!partial) {
    if (!isNonEmptyString(body?.name)) errors.push({ field: "name", message: "Name is required." });
  }

  if (body?.name !== undefined && !isNonEmptyString(body.name)) {
    errors.push({ field: "name", message: "Name must be a non-empty string." });
  }

  if (body?.genre !== undefined && typeof body.genre !== "string") {
    errors.push({ field: "genre", message: "Genre must be a string." });
  }

  if (body?.location !== undefined && typeof body.location !== "string") {
    errors.push({ field: "location", message: "Location must be a string." });
  }

  if (body?.bio !== undefined && typeof body.bio !== "string") {
    errors.push({ field: "bio", message: "Bio must be a string." });
  }

  if (body?.imageUrl !== undefined && typeof body.imageUrl !== "string") {
    errors.push({ field: "imageUrl", message: "imageUrl must be a string." });
  }

  if (body?.status !== undefined) {
    const s = String(body.status || "").toLowerCase().trim();
    if (!["active", "pending", "disabled"].includes(s)) {
      errors.push({ field: "status", message: "Status must be one of: active, pending, disabled." });
    }
  }

  if (body?.links !== undefined && (body.links === null || typeof body.links !== "object" || Array.isArray(body.links))) {
    errors.push({ field: "links", message: "links must be an object." });
  }

  if (body?.tracks !== undefined && !Array.isArray(body.tracks)) {
    errors.push({ field: "tracks", message: "tracks must be an array." });
  }

  if (body?.votes !== undefined) {
    const v = Number(body.votes);
    if (!Number.isFinite(v) || v < 0) errors.push({ field: "votes", message: "votes must be a non-negative number." });
  }

  return errors;
}

function findArtistById(id) {
  return artists.find((a) => a.id === id && a.status !== "deleted");
}

function publicArtist(a) {
  // Keep future-proof fields even if empty
  return {
    id: a.id,
    name: a.name,
    genre: a.genre || "",
    location: a.location || "",
    bio: a.bio || "",
    imageUrl: a.imageUrl || "",
    links: a.links || normalizeLinks(),
    tracks: Array.isArray(a.tracks) ? a.tracks : [],
    votes: Number.isFinite(a.votes) ? a.votes : 0,
    status: a.status || "active",
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

function seedDemoIfMissing() {
  const demo = artists.find((a) => a.id === "demo");
  if (demo) return;

  const demoArtist = {
    id: "demo",
    name: "Demo Artist",
    genre: "Pop / Urban",
    location: "London, UK",
    bio: "This is a demo placeholder. Next phase will display a real artist with track previews and comments.",
    imageUrl: "",
    links: normalizeLinks({
      instagram: "https://instagram.com/",
      youtube: "https://youtube.com/",
      spotify: "https://spotify.com/",
      soundcloud: "https://soundcloud.com/",
      website: "https://ibandbyte.com",
    }),
    tracks: normalizeTracks([
      {
        title: "Demo Track",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        platform: "mp3",
        durationSec: 30,
      },
    ]),
    votes: 42,
    status: "active",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  artists.unshift(demoArtist);
  saveToDisk();
}
seedDemoIfMissing();

// ----------------------
// Routes
// ----------------------

// GET /artists/health (route-level)
artistsRouter.get("/health", (req, res) => {
  return ok(res, { service: "artists", status: "ok" });
});

// GET /artists
// Query: q, genre, location, status, sort (new|votes|name), order (asc|desc), page, limit
artistsRouter.get("/", (req, res) => {
  const q = safeString(req.query.q, "").toLowerCase();
  const genre = safeString(req.query.genre, "").toLowerCase();
  const location = safeString(req.query.location, "").toLowerCase();
  const status = safeString(req.query.status, "").toLowerCase();

  const sort = safeString(req.query.sort, "new").toLowerCase(); // new|votes|name
  const order = safeString(req.query.order, "desc").toLowerCase(); // asc|desc

  const page = clamp(toInt(req.query.page, 1), 1, 999999);
  const limit = clamp(toInt(req.query.limit, 20), 1, 100);

  let list = artists.filter((a) => a.status !== "deleted");

  if (status) list = list.filter((a) => (a.status || "active") === status);

  if (q) {
    list = list.filter((a) => {
      const hay = `${a.name || ""} ${a.genre || ""} ${a.location || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  if (genre) list = list.filter((a) => String(a.genre || "").toLowerCase().includes(genre));
  if (location) list = list.filter((a) => String(a.location || "").toLowerCase().includes(location));

  // Sorting
  const dir = order === "asc" ? 1 : -1;
  list.sort((a, b) => {
    if (sort === "name") return String(a.name || "").localeCompare(String(b.name || "")) * dir;
    if (sort === "votes") return ((a.votes || 0) - (b.votes || 0)) * dir;
    // default "new" -> createdAt desc
    return String(a.createdAt || "").localeCompare(String(b.createdAt || "")) * dir;
  });

  const total = list.length;
  const start = (page - 1) * limit;
  const end = start + limit;
  const paged = list.slice(start, end).map(publicArtist);

  return ok(res, paged, { page, limit, total });
});

// GET /artists/demo
artistsRouter.get("/demo", (req, res) => {
  const a = findArtistById("demo");
  if (!a) return notFound(res, "Demo artist not found.");
  return ok(res, publicArtist(a));
});

// GET /artists/:id
artistsRouter.get("/:id", (req, res) => {
  const id = safeString(req.params.id, "");
  const a = findArtistById(id);
  if (!a) return notFound(res, "Artist not found.");
  return ok(res, publicArtist(a));
});

// POST /artists
artistsRouter.post("/", express.json({ limit: "1mb" }), (req, res) => {
  const errors = validateArtistInput(req.body, { partial: false });
  if (errors.length) return badRequest(res, "Validation failed.", errors);

  const artist = {
    id: makeId(),
    name: safeString(req.body.name),
    genre: safeString(req.body.genre, ""),
    location: safeString(req.body.location, ""),
    bio: safeString(req.body.bio, ""),
    imageUrl: safeString(req.body.imageUrl, ""),
    links: normalizeLinks(req.body.links),
    tracks: normalizeTracks(req.body.tracks),
    votes: clamp(toInt(req.body.votes, 0), 0, Number.MAX_SAFE_INTEGER),
    status: normalizeStatus(req.body.status || "active"),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  artists.unshift(artist);
  saveToDisk();
  return created(res, publicArtist(artist));
});

// PUT /artists/:id (replace)
artistsRouter.put("/:id", express.json({ limit: "1mb" }), (req, res) => {
  const id = safeString(req.params.id, "");
  const existing = findArtistById(id);
  if (!existing) return notFound(res, "Artist not found.");

  const errors = validateArtistInput(req.body, { partial: false });
  if (errors.length) return badRequest(res, "Validation failed.", errors);

  existing.name = safeString(req.body.name);
  existing.genre = safeString(req.body.genre, "");
  existing.location = safeString(req.body.location, "");
  existing.bio = safeString(req.body.bio, "");
  existing.imageUrl = safeString(req.body.imageUrl, "");
  existing.links = normalizeLinks(req.body.links);
  existing.tracks = normalizeTracks(req.body.tracks);
  existing.votes = clamp(toInt(req.body.votes, existing.votes || 0), 0, Number.MAX_SAFE_INTEGER);
  existing.status = normalizeStatus(req.body.status || existing.status || "active");
  existing.updatedAt = nowIso();

  saveToDisk();
  return ok(res, publicArtist(existing));
});

// PATCH /artists/:id (partial update)
artistsRouter.patch("/:id", express.json({ limit: "1mb" }), (req, res) => {
  const id = safeString(req.params.id, "");
  const existing = findArtistById(id);
  if (!existing) return notFound(res, "Artist not found.");

  const errors = validateArtistInput(req.body, { partial: true });
  if (errors.length) return badRequest(res, "Validation failed.", errors);

  if (req.body.name !== undefined) existing.name = safeString(req.body.name);
  if (req.body.genre !== undefined) existing.genre = safeString(req.body.genre, "");
  if (req.body.location !== undefined) existing.location = safeString(req.body.location, "");
  if (req.body.bio !== undefined) existing.bio = safeString(req.body.bio, "");
  if (req.body.imageUrl !== undefined) existing.imageUrl = safeString(req.body.imageUrl, "");
  if (req.body.links !== undefined) existing.links = normalizeLinks(req.body.links);
  if (req.body.tracks !== undefined) existing.tracks = normalizeTracks(req.body.tracks);
  if (req.body.votes !== undefined) existing.votes = clamp(toInt(req.body.votes, existing.votes || 0), 0, Number.MAX_SAFE_INTEGER);
  if (req.body.status !== undefined) existing.status = normalizeStatus(req.body.status);

  existing.updatedAt = nowIso();
  saveToDisk();
  return ok(res, publicArtist(existing));
});

// DELETE /artists/:id (soft delete)
artistsRouter.delete("/:id", (req, res) => {
  const id = safeString(req.params.id, "");
  const existing = findArtistById(id);
  if (!existing) return notFound(res, "Artist not found.");

  existing.status = "deleted";
  existing.updatedAt = nowIso();
  saveToDisk();
  return ok(res, { id, deleted: true });
});

// POST /artists/:id/votes  body: { amount: 1 } (default 1)
artistsRouter.post("/:id/votes", express.json({ limit: "10kb" }), (req, res) => {
  const id = safeString(req.params.id, "");
  const existing = findArtistById(id);
  if (!existing) return notFound(res, "Artist not found.");

  const amount = clamp(toInt(req.body?.amount, 1), 1, 1000);
  existing.votes = clamp(toInt(existing.votes, 0) + amount, 0, Number.MAX_SAFE_INTEGER);
  existing.updatedAt = nowIso();

  saveToDisk();
  return ok(res, { id: existing.id, votes: existing.votes });
});