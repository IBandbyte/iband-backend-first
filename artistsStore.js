/**
 * artistsStore.js (ESM) — PERSISTENCE HARDENED
 *
 * Single source of truth for artist persistence.
 * Used by:
 * - public artists routes (artists.js)
 * - admin moderation routes (adminArtists.js)
 *
 * Storage:
 * - Disk persistence to IBAND_DATA_DIR (recommended: /var/data on Render persistent disk)
 * - Falls back to ./db for local dev
 * - In-memory fallback always works
 *
 * IMPORTANT:
 * This store intentionally supports BOTH:
 * - modern method names (listArtists/getArtist/createArtist/updateArtist/patchArtist/deleteArtist/resetArtists/seedArtists)
 * - legacy/router-friendly aliases (getAll/getById/create/update/patch/remove/reset/seed)
 */

import fs from "fs";
import path from "path";

/* -------------------- Helpers -------------------- */

const nowIso = () => new Date().toISOString();
const safeText = (v) => (v === null || v === undefined ? "" : String(v)).trim();
const ensureArray = (v) => (Array.isArray(v) ? v : []);

const toNumber = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeStatus = (s) => {
  const v = String(s || "").toLowerCase().trim();
  if (["pending", "active", "rejected"].includes(v)) return v;
  return "active";
};

function normalizeArtist(raw = {}) {
  const socials = raw.socials && typeof raw.socials === "object" ? raw.socials : {};
  const tracks = ensureArray(raw.tracks);

  return {
    id: safeText(raw.id || raw._id || raw.slug || `artist-${Date.now()}`),
    name: safeText(raw.name || "Unnamed Artist"),
    genre: safeText(raw.genre || ""),
    location: safeText(raw.location || ""),
    bio: safeText(raw.bio || ""),
    imageUrl: safeText(raw.imageUrl || ""),
    socials: {
      instagram: safeText(socials.instagram),
      tiktok: safeText(socials.tiktok),
      youtube: safeText(socials.youtube),
      spotify: safeText(socials.spotify),
      soundcloud: safeText(socials.soundcloud),
      website: safeText(socials.website),
    },
    tracks: tracks.map((t) => ({
      title: safeText(t?.title),
      url: safeText(t?.url),
      platform: safeText(t?.platform),
      durationSec: toNumber(t?.durationSec, 0),
    })),
    votes: toNumber(raw.votes, 0),
    status: normalizeStatus(raw.status),
    createdAt: safeText(raw.createdAt || nowIso()),
    updatedAt: safeText(raw.updatedAt || nowIso()),
  };
}

/* -------------------- Persistence -------------------- */

// ✅ If you set IBAND_DATA_DIR=/var/data on Render (persistent disk), data survives deploys.
const DATA_DIR = safeText(process.env.IBAND_DATA_DIR);
const ROOT = process.cwd();

// Default local dev path
const FALLBACK_DB_DIR = path.join(ROOT, "db");

// Use persistent disk if provided, else fallback to local folder
const DB_DIR = DATA_DIR || FALLBACK_DB_DIR;
const DB_FILE = path.join(DB_DIR, "artists.json");

let artists = [];

// Persistence diagnostics (so we stop guessing)
let lastSaveOk = false;
let lastSaveError = "";
let lastLoadedOk = false;
let lastLoadedError = "";
let lastIoAt = "";

/* -------------------- Seed -------------------- */

function ensureDemo() {
  if (artists.length) return;
  artists = [
    normalizeArtist({
      id: "demo",
      name: "Demo Artist",
      genre: "Pop / Urban",
      location: "London, UK",
      bio: "Demo artist used for initial platform validation.",
      votes: 42,
      status: "active",
      tracks: [{ title: "Demo Track", platform: "mp3", durationSec: 30 }],
    }),
  ];
}

/* -------------------- IO -------------------- */

function loadFromDisk() {
  lastLoadedOk = false;
  lastLoadedError = "";
  lastIoAt = nowIso();

  try {
    if (!fs.existsSync(DB_FILE)) {
      ensureDemo();
      lastLoadedOk = true;
      return;
    }

    const raw = fs.readFileSync(DB_FILE, "utf8");
    const parsed = JSON.parse(raw);

    // Supports either { data: [...] } or raw array
    const list = ensureArray(parsed?.data || parsed);
    artists = list.map(normalizeArtist);

    if (!artists.length) ensureDemo();

    lastLoadedOk = true;
  } catch (e) {
    lastLoadedError = safeText(e?.message) || "loadFromDisk failed";
    ensureDemo();
  }
}

function saveToDisk() {
  lastSaveOk = false;
  lastSaveError = "";
  lastIoAt = nowIso();

  try {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

    const payload = {
      updatedAt: nowIso(),
      data: artists,
    };

    fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), "utf8");
    lastSaveOk = true;
    return true;
  } catch (e) {
    lastSaveError = safeText(e?.message) || "saveToDisk failed";
    return false;
  }
}

loadFromDisk();

/* -------------------- Core CRUD (modern) -------------------- */

export function listArtists() {
  return ensureArray(artists);
}

export function getArtist(id) {
  const clean = safeText(id);
  if (!clean) return null;
  return artists.find((a) => a.id === clean) || null;
}

export function createArtist(data) {
  const a = normalizeArtist(data);

  // ensure unique id
  if (getArtist(a.id)) a.id = `${a.id}-${Date.now()}`;

  a.createdAt = nowIso();
  a.updatedAt = nowIso();

  artists.unshift(a);
  saveToDisk();
  return a;
}

export function updateArtist(id, patch) {
  const clean = safeText(id);
  const idx = artists.findIndex((a) => a.id === clean);
  if (idx === -1) return null;

  const existing = artists[idx];
  const next = normalizeArtist({ ...existing, ...patch });

  next.id = existing.id;
  next.createdAt = existing.createdAt;
  next.updatedAt = nowIso();

  artists[idx] = next;
  saveToDisk();
  return next;
}

export function patchArtist(id, patch) {
  const clean = safeText(id);
  const existing = getArtist(clean);
  if (!existing) return null;

  const merged = {
    ...existing,
    ...patch,
    socials: patch?.socials ? { ...existing.socials, ...patch.socials } : existing.socials,
    tracks: patch?.tracks !== undefined ? patch.tracks : existing.tracks,
  };

  return updateArtist(clean, merged);
}

export function deleteArtist(id) {
  const clean = safeText(id);
  const idx = artists.findIndex((a) => a.id === clean);
  if (idx === -1) return null;

  const removed = artists.splice(idx, 1)[0] || null;

  if (!artists.length) ensureDemo();
  saveToDisk();

  return removed;
}

export function resetArtists() {
  const deleted = artists.length;
  artists = [];
  ensureDemo();
  saveToDisk();
  return deleted;
}

export function seedArtists() {
  const before = artists.length;

  const demoArtists = [
    {
      id: `demo-${Date.now()}-a`,
      name: "Aria Nova",
      genre: "Pop",
      bio: "Rising star blending electro-pop with dreamy vocals.",
      votes: 12,
      status: "active",
    },
    {
      id: `demo-${Date.now()}-b`,
      name: "Neon Harbor",
      genre: "Synthwave",
      bio: "Retro-futuristic vibes, heavy synth, 80s nostalgia.",
      votes: 8,
      status: "active",
    },
    {
      id: `demo-${Date.now()}-c`,
      name: "Stone & Sparrow",
      genre: "Indie Folk",
      bio: "Acoustic harmonies, storytelling, and soulful strings.",
      votes: 20,
      status: "active",
    },
  ];

  demoArtists.forEach((a) => createArtist(a));
  return artists.length - before;
}

/* -------------------- Router-friendly aliases -------------------- */

function getAll() {
  return listArtists();
}

function getById(id) {
  return getArtist(id);
}

function create(payload) {
  return createArtist(payload);
}

function update(id, payload) {
  return updateArtist(id, payload);
}

function patch(id, payload) {
  return patchArtist(id, payload);
}

function remove(id) {
  return deleteArtist(id);
}

function reset() {
  return resetArtists();
}

function seed() {
  return seedArtists();
}

/* -------------------- Diagnostics -------------------- */

export function getPersistenceStatus() {
  return {
    dbDir: DB_DIR,
    dbFile: DB_FILE,
    lastSaveOk,
    lastSaveError,
    lastLoadedOk,
    lastLoadedError,
    lastIoAt,
    count: artists.length,
  };
}

/* -------------------- Default export -------------------- */

export default {
  // modern
  listArtists,
  getArtist,
  createArtist,
  updateArtist,
  patchArtist,
  deleteArtist,
  resetArtists,
  seedArtists,

  // aliases
  getAll,
  getById,
  create,
  update,
  patch,
  remove,
  reset,
  seed,

  // diagnostics
  getPersistenceStatus,

  // debugging (kept)
  save: saveToDisk,
  get artists() {
    return artists;
  },
};