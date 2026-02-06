/**
 * artistsStore.js (ESM)
 *
 * Single source of truth for artist persistence.
 * Used by:
 * - public artists routes (artists.js)
 * - admin moderation routes (adminArtists.js)
 *
 * Storage:
 * - Prefer Render persistent disk: /var/data (or process.env.IBAND_DATA_DIR)
 * - Fallback to local ./db (works locally, but may reset on redeploy without disk)
 *
 * IMPORTANT:
 * Supports BOTH:
 * - modern names (listArtists/getArtist/createArtist/updateArtist/patchArtist/deleteArtist)
 * - aliases (getAll/getById/create/update/patch/remove/reset/seed)
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

/* -------------------- Persistence Paths -------------------- */

// Render persistent disk conventional mount:
const RENDER_DISK_DEFAULT = "/var/data";

// Allow override (future-proof)
const DATA_DIR =
  safeText(process.env.IBAND_DATA_DIR) ||
  safeText(process.env.DATA_DIR) ||
  RENDER_DISK_DEFAULT;

const LOCAL_FALLBACK_DIR = path.join(process.cwd(), "db");

// Prefer disk dir if it exists or can be created, else fallback local
function resolveDbDir() {
  // If /var/data exists (or custom), use it
  try {
    if (DATA_DIR) {
      if (!fs.existsSync(DATA_DIR)) {
        // attempt to create (will fail if not mounted/allowed)
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      // write test folder inside data dir
      const test = path.join(DATA_DIR, ".iband_write_test");
      fs.writeFileSync(test, "ok", "utf8");
      fs.unlinkSync(test);
      return DATA_DIR;
    }
  } catch {
    // ignore
  }

  // fallback local ./db
  try {
    if (!fs.existsSync(LOCAL_FALLBACK_DIR)) fs.mkdirSync(LOCAL_FALLBACK_DIR, { recursive: true });
  } catch {
    // ignore
  }
  return LOCAL_FALLBACK_DIR;
}

const DB_DIR = resolveDbDir();
const DB_FILE = path.join(DB_DIR, "artists.json");

let artists = [];

/* -------------------- Seed Demo -------------------- */

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

/* -------------------- Load / Save -------------------- */

function loadFromDisk() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      ensureDemo();
      return;
    }
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const list = ensureArray(parsed?.data || parsed);
    artists = list.map(normalizeArtist);
    if (!artists.length) ensureDemo();
  } catch {
    ensureDemo();
  }
}

function saveToDisk() {
  try {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify({ updatedAt: nowIso(), data: artists }, null, 2), "utf8");
    return true;
  } catch {
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
      imageUrl: "",
      votes: 12,
      status: "active",
    },
    {
      id: `demo-${Date.now()}-b`,
      name: "Neon Harbor",
      genre: "Synthwave",
      bio: "Retro-futuristic vibes, heavy synth, 80s nostalgia.",
      imageUrl: "",
      votes: 8,
      status: "active",
    },
    {
      id: `demo-${Date.now()}-c`,
      name: "Stone & Sparrow",
      genre: "Indie Folk",
      bio: "Acoustic harmonies, storytelling, and soulful strings.",
      imageUrl: "",
      votes: 20,
      status: "active",
    },
  ];

  demoArtists.forEach((a) => createArtist(a));
  return artists.length - before;
}

/* -------------------- Aliases -------------------- */

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

  // debugging
  save: saveToDisk,
  get artists() {
    return artists;
  },

  // extra visibility
  dbFile: DB_FILE,
  dbDir: DB_DIR,
};