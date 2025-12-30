/**
 * artistsStore.js (ESM)
 * Single source of truth for artist persistence.
 *
 * Supports:
 * - listArtists()
 * - getArtist(id)
 * - createArtist(data)
 * - updateArtist(id, patch)
 * - deleteArtist(id)
 * - save() (persist to disk if available)
 *
 * Notes:
 * - Works in Render ESM ("type":"module")
 * - Uses db/artists.json if available, otherwise in-memory fallback
 */

import fs from "fs";
import path from "path";

function nowIso() {
  return new Date().toISOString();
}

function safeText(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function makeId(raw) {
  const s = safeText(raw).trim();
  return s;
}

function normalizeStatus(s) {
  const v = String(s || "").toLowerCase().trim();
  if (!v) return "active";
  if (v === "pending" || v === "active" || v === "rejected") return v;
  return "active";
}

function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

function normalizeArtist(raw) {
  const a = raw || {};
  const socials = a.socials && typeof a.socials === "object" ? a.socials : {};
  const tracks = ensureArray(a.tracks);

  const id = makeId(a.id || a._id || a.slug || "");
  return {
    id: id || "demo",
    name: safeText(a.name || "Unnamed Artist"),
    genre: safeText(a.genre || a.primaryGenre || ""),
    location: safeText(a.location || a.city || a.country || ""),
    bio: safeText(a.bio || a.description || ""),
    imageUrl: safeText(a.imageUrl || a.image || ""),
    socials: {
      instagram: safeText(socials.instagram || ""),
      tiktok: safeText(socials.tiktok || ""),
      youtube: safeText(socials.youtube || ""),
      spotify: safeText(socials.spotify || ""),
      soundcloud: safeText(socials.soundcloud || ""),
      website: safeText(socials.website || ""),
    },
    tracks: tracks
      .map((t) => ({
        title: safeText(t?.title || ""),
        url: safeText(t?.url || ""),
        platform: safeText(t?.platform || ""),
        durationSec: toNumber(t?.durationSec, 0),
      }))
      .filter((t) => t.title || t.url),
    votes: toNumber(a.votes, 0),
    status: normalizeStatus(a.status),
    createdAt: safeText(a.createdAt || nowIso()),
    updatedAt: safeText(a.updatedAt || nowIso()),
  };
}

const ROOT = process.cwd();
const DB_DIR = path.join(ROOT, "db");
const DB_FILE = path.join(DB_DIR, "artists.json");

// In-memory store (always available)
let artists = [];

// Ensure a baseline demo record exists if empty
function ensureDemo() {
  if (artists.length) return;
  artists = [
    normalizeArtist({
      id: "demo",
      name: "Demo Artist",
      genre: "Pop / Urban",
      location: "London, UK",
      bio: "This is a demo placeholder. Next phase will display a real artist with track previews and comments.",
      votes: 42,
      status: "active",
      tracks: [{ title: "Demo Track", platform: "mp3", durationSec: 30, url: "" }],
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
    const list = ensureArray(parsed?.data || parsed?.artists || parsed);
    artists = list.map(normalizeArtist);
    if (!artists.length) ensureDemo();
  } catch {
    ensureDemo();
  }
}

function saveToDisk() {
  try {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    const payload = { updatedAt: nowIso(), data: artists };
    fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), "utf8");
    return true;
  } catch {
    // On Render, disk is ephemeral; ignore errors but keep in-memory functional
    return false;
  }
}

// Load once at startup
loadFromDisk();

/** PUBLIC API (ESM exports) **/

export function listArtists() {
  return ensureArray(artists);
}

export function getArtist(id) {
  const cleanId = makeId(id);
  if (!cleanId) return null;
  return (
    artists.find((a) => makeId(a.id) === cleanId) ||
    artists.find((a) => makeId(a._id) === cleanId) ||
    artists.find((a) => makeId(a.slug) === cleanId) ||
    null
  );
}

export function createArtist(data) {
  const a = normalizeArtist(data || {});
  const exists = getArtist(a.id);
  if (exists) {
    // if id collides, append timestamp
    a.id = `${a.id}-${Date.now()}`;
  }
  a.createdAt = nowIso();
  a.updatedAt = nowIso();
  artists.unshift(a);
  saveToDisk();
  return a;
}

export function updateArtist(id, patch) {
  const cleanId = makeId(id);
  if (!cleanId) return null;

  const idx = artists.findIndex((a) => makeId(a.id) === cleanId);
  if (idx === -1) return null;

  const existing = artists[idx] || {};
  const next = normalizeArtist({ ...existing, ...(patch || {}) });

  // Preserve immutable bits
  next.id = existing.id;
  next.createdAt = existing.createdAt || next.createdAt;
  next.updatedAt = nowIso();

  artists[idx] = next;
  saveToDisk();
  return next;
}

export function deleteArtist(id) {
  const cleanId = makeId(id);
  if (!cleanId) return false;

  const idx = artists.findIndex((a) => makeId(a.id) === cleanId);
  if (idx === -1) return false;

  artists.splice(idx, 1);
  if (!artists.length) ensureDemo();
  saveToDisk();
  return true;
}

export function save() {
  return saveToDisk();
}

// Optional default export for compatibility with older imports
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