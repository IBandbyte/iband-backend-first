/**
 * artistsStore.js (ESM — CANONICAL + COMPAT)
 *
 * Single source of truth for artist persistence.
 * - Canonical methods (listArtists, getArtist, createArtist, updateArtist, deleteArtist)
 * - Compatibility aliases for existing routers (getAll, getById, create, update, patch, remove)
 *
 * Storage:
 * - In-memory with optional disk persistence (Render-safe)
 */

import fs from "fs";
import path from "path";

/* -------------------- Helpers -------------------- */

const nowIso = () => new Date().toISOString();
const safeText = (v) => (v === null || v === undefined ? "" : String(v));
const toNumber = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const ensureArray = (v) => (Array.isArray(v) ? v : []);
const normalizeStatus = (s) => {
  const v = String(s || "").toLowerCase().trim();
  if (["pending", "active", "rejected"].includes(v)) return v;
  return "active";
};

/* -------------------- Normalizer -------------------- */

function normalizeArtist(raw = {}) {
  const socials = raw.socials && typeof raw.socials === "object" ? raw.socials : {};
  const tracks = ensureArray(raw.tracks);

  return {
    id: safeText(raw.id || raw._id || raw.slug || "demo"),
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

/* -------------------- Storage -------------------- */

const ROOT = process.cwd();
const DB_DIR = path.join(ROOT, "db");
const DB_FILE = path.join(DB_DIR, "artists.json");

let artists = [];

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
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify({ updatedAt: nowIso(), data: artists }, null, 2),
      "utf8"
    );
    return true;
  } catch {
    return false;
  }
}

/* Load once */
loadFromDisk();

/* -------------------- Canonical API -------------------- */

function listArtists() {
  return ensureArray(artists);
}

function getArtist(id) {
  const clean = safeText(id);
  if (!clean) return null;
  return artists.find((a) => a.id === clean) || null;
}

function createArtist(data) {
  const a = normalizeArtist(data);
  if (getArtist(a.id)) a.id = `${a.id}-${Date.now()}`;
  a.createdAt = nowIso();
  a.updatedAt = nowIso();
  artists.unshift(a);
  saveToDisk();
  return a;
}

function updateArtist(id, patch) {
  const idx = artists.findIndex((a) => a.id === safeText(id));
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

function deleteArtist(id) {
  const idx = artists.findIndex((a) => a.id === safeText(id));
  if (idx === -1) return false;

  artists.splice(idx, 1);
  if (!artists.length) ensureDemo();
  saveToDisk();
  return true;
}

/* -------------------- Compatibility Aliases -------------------- */
// Public + Admin routers expect these names

function getAll() {
  return listArtists();
}
function getById(id) {
  return getArtist(id);
}
function create(data) {
  return createArtist(data);
}
function update(id, patch) {
  return updateArtist(id, patch);
}
function patch(id, patchObj) {
  return updateArtist(id, patchObj);
}
function remove(id) {
  const ok = deleteArtist(id);
  return ok ? true : null;
}
function reset() {
  const count = artists.length;
  artists = [];
  ensureDemo();
  saveToDisk();
  return count;
}
function seed() {
  const before = artists.length;
  ensureDemo();
  saveToDisk();
  return artists.length - before;
}

/* -------------------- Exports -------------------- */

export {
  listArtists,
  getArtist,
  createArtist,
  updateArtist,
  deleteArtist,
};

export default {
  // Canonical
  listArtists,
  getArtist,
  createArtist,
  updateArtist,
  deleteArtist,

  // Compatibility
  getAll,
  getById,
  create,
  update,
  patch,
  remove,
  reset,
  seed,

  // Debug
  get artists() {
    return artists;
  },
};