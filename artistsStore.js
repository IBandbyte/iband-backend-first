/**
 * artistsStore.js (ESM ONLY — LOCKED)
 *
 * Single source of truth for artist persistence.
 * Used by:
 * - public artists routes
 * - admin moderation routes
 *
 * Node: ESM ("type":"module")
 * Storage:
 * - In-memory (always works)
 * - Optional disk persistence (Render-safe fallback)
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

const normalizeStatus = (s) => {
  const v = String(s || "").toLowerCase().trim();
  if (["pending", "active", "rejected"].includes(v)) return v;
  return "active";
};

const ensureArray = (v) => (Array.isArray(v) ? v : []);

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

/* -------------------- Public API -------------------- */

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
  if (getArtist(a.id)) a.id = `${a.id}-${Date.now()}`;
  a.createdAt = nowIso();
  a.updatedAt = nowIso();
  artists.unshift(a);
  saveToDisk();
  return a;
}

export function updateArtist(id, patch) {
  const idx = artists.findIndex((a) => a.id === id);
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

export function deleteArtist(id) {
  const idx = artists.findIndex((a) => a.id === id);
  if (idx === -1) return false;

  artists.splice(idx, 1);
  if (!artists.length) ensureDemo();
  saveToDisk();
  return true;
}

export function save() {
  return saveToDisk();
}

/* Default export for admin + legacy safety */
export default {
  listArtists,
  getArtist,
  createArtist,
  updateArtist,
  deleteArtist,
  save,
  get artists() {
    return artists;
  },
};