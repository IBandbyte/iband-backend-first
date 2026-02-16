/**
 * artists.js (root) — ESM default export
 * Canonical Artists Router (v1)
 *
 * Storage:
 * - Persistent disk on Render
 * - /var/data/iband/db/artists.json
 *
 * Features:
 * - GET list, GET by id
 * - POST create
 * - PUT replace
 * - PATCH partial update
 * - DELETE remove
 * - Seeds a demo artist if file is empty/missing
 */

import express from "express";
import fs from "fs/promises";
import path from "path";

const router = express.Router();

/* -----------------------------
 * Config
 * ----------------------------- */
const DATA_DIR = process.env.DATA_DIR || "/var/data/iband/db";
const ARTISTS_FILE = process.env.ARTISTS_FILE || path.join(DATA_DIR, "artists.json");

const MAX_BODY_KB = parseInt(process.env.ARTISTS_MAX_BODY_KB || "64", 10);
const routerVersion = 1;

/* -----------------------------
 * Helpers
 * ----------------------------- */
function nowIso() {
  return new Date().toISOString();
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function safeString(v, maxLen = 160) {
  if (!isNonEmptyString(v)) return null;
  return v.trim().slice(0, maxLen);
}

function normalizeId(v, maxLen = 80) {
  const s = safeString(v, maxLen);
  if (!s) return "";
  if (!/^[a-zA-Z0-9._:-]+$/.test(s)) return "";
  return s;
}

function cleanUrl(v, maxLen = 500) {
  const s = safeString(v, maxLen);
  if (!s) return null;
  // allow http(s) only; keep it simple
  if (!/^https?:\/\//i.test(s)) return null;
  return s;
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJsonSafe(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(filePath, obj) {
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

function makeStoreSkeleton() {
  return {
    version: 1,
    updatedAt: null,
    artists: [],
  };
}

function seedDemoArtist() {
  return {
    id: "demo",
    name: "Demo Artist",
    genre: "Pop / Urban",
    location: "London, UK",
    bio: "Demo artist used for initial platform validation.",
    imageUrl: null,
    socials: {
      instagram: null,
      tiktok: null,
      youtube: null,
      spotify: null,
      soundcloud: null,
      website: null,
    },
    tracks: [
      { title: "Demo Track", url: null, platform: "mp3", durationSec: 30 }
    ],
    status: "active",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function normalizeArtistPayload(body, { requireId = false } = {}) {
  const id = body?.id !== undefined ? normalizeId(body.id) : "";
  if (requireId && !id) return { ok: false, error: "Invalid id." };

  const name = safeString(body?.name, 120);
  const genre = safeString(body?.genre, 80);
  const location = safeString(body?.location, 120);
  const bio = safeString(body?.bio, 800);

  const imageUrl = body?.imageUrl !== undefined ? cleanUrl(body.imageUrl) : undefined;

  const socials = body?.socials && typeof body.socials === "object" && !Array.isArray(body.socials)
    ? {
        instagram: body.socials.instagram ? cleanUrl(body.socials.instagram) : null,
        tiktok: body.socials.tiktok ? cleanUrl(body.socials.tiktok) : null,
        youtube: body.socials.youtube ? cleanUrl(body.socials.youtube) : null,
        spotify: body.socials.spotify ? cleanUrl(body.socials.spotify) : null,
        soundcloud: body.socials.soundcloud ? cleanUrl(body.socials.soundcloud) : null,
        website: body.socials.website ? cleanUrl(body.socials.website) : null,
      }
    : undefined;

  const tracks = Array.isArray(body?.tracks)
    ? body.tracks.slice(0, 20).map((t) => ({
        title: safeString(t?.title, 120) || "Untitled",
        url: t?.url ? cleanUrl(t.url) : null,
        platform: safeString(t?.platform, 40) || null,
        durationSec: Number.isFinite(Number(t?.durationSec)) ? Math.max(0, Math.trunc(Number(t.durationSec))) : null,
      }))
    : undefined;

  const status = body?.status !== undefined ? safeString(body.status, 24) : undefined;

  return {
    ok: true,
    artist: {
      ...(id ? { id } : {}),
      ...(name !== null ? { name } : {}),
      ...(genre !== null ? { genre } : {}),
      ...(location !== null ? { location } : {}),
      ...(bio !== null ? { bio } : {}),
      ...(imageUrl !== undefined ? { imageUrl } : {}),
      ...(socials !== undefined ? { socials } : {}),
      ...(tracks !== undefined ? { tracks } : {}),
      ...(status !== undefined ? { status } : {}),
    },
  };
}

async function loadStore() {
  await ensureDataDir();
  const base = makeStoreSkeleton();
  const store = await readJsonSafe(ARTISTS_FILE, base);

  if (!store || typeof store !== "object") return base;
  if (!Array.isArray(store.artists)) store.artists = [];

  // Seed demo if empty
  if (store.artists.length === 0) {
    store.artists = [seedDemoArtist()];
    store.updatedAt = nowIso();
    await writeJsonAtomic(ARTISTS_FILE, store);
  }

  return store;
}

async function saveStore(store) {
  store.updatedAt = nowIso();
  await writeJsonAtomic(ARTISTS_FILE, store);
}

/* -----------------------------
 * Middleware
 * ----------------------------- */
router.use(express.json({ limit: `${MAX_BODY_KB}kb` }));

/* -----------------------------
 * Health
 * ----------------------------- */
router.get("/health", async (_req, res) => {
  const store = await loadStore();
  res.json({
    success: true,
    service: "artists",
    version: routerVersion,
    dataDir: DATA_DIR,
    file: path.basename(ARTISTS_FILE),
    count: store.artists.length,
    updatedAt: store.updatedAt,
  });
});

/* -----------------------------
 * GET endpoints
 * ----------------------------- */
router.get("/", async (_req, res) => {
  const store = await loadStore();
  res.json({
    success: true,
    count: store.artists.length,
    updatedAt: store.updatedAt,
    artists: store.artists,
  });
});

router.get("/:id", async (req, res) => {
  const id = normalizeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: "Invalid id." });

  const store = await loadStore();
  const artist = store.artists.find((a) => a.id === id);
  if (!artist) return res.status(404).json({ success: false, message: "Artist not found." });

  res.json({ success: true, artist, updatedAt: store.updatedAt });
});

/* -----------------------------
 * POST endpoints
 * ----------------------------- */
router.post("/", async (req, res) => {
  const parsed = normalizeArtistPayload(req.body, { requireId: true });
  if (!parsed.ok) return res.status(400).json({ success: false, message: parsed.error });

  const store = await loadStore();
  const exists = store.artists.some((a) => a.id === parsed.artist.id);
  if (exists) return res.status(409).json({ success: false, message: "Artist id already exists." });

  const artist = {
    id: parsed.artist.id,
    name: parsed.artist.name || null,
    genre: parsed.artist.genre || null,
    location: parsed.artist.location || null,
    bio: parsed.artist.bio || null,
    imageUrl: parsed.artist.imageUrl ?? null,
    socials: parsed.artist.socials ?? {
      instagram: null,
      tiktok: null,
      youtube: null,
      spotify: null,
      soundcloud: null,
      website: null,
    },
    tracks: parsed.artist.tracks ?? [],
    status: parsed.artist.status || "active",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  store.artists.push(artist);
  await saveStore(store);

  res.status(201).json({ success: true, message: "Artist created.", artist, updatedAt: store.updatedAt });
});

/* -----------------------------
 * PUT endpoints
 * ----------------------------- */
router.put("/:id", async (req, res) => {
  const id = normalizeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: "Invalid id." });

  const parsed = normalizeArtistPayload({ ...req.body, id }, { requireId: true });
  if (!parsed.ok) return res.status(400).json({ success: false, message: parsed.error });

  const store = await loadStore();
  const idx = store.artists.findIndex((a) => a.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Artist not found." });

  const prev = store.artists[idx];

  const next = {
    id,
    name: parsed.artist.name ?? null,
    genre: parsed.artist.genre ?? null,
    location: parsed.artist.location ?? null,
    bio: parsed.artist.bio ?? null,
    imageUrl: parsed.artist.imageUrl !== undefined ? (parsed.artist.imageUrl ?? null) : (prev.imageUrl ?? null),
    socials: parsed.artist.socials !== undefined ? (parsed.artist.socials ?? prev.socials) : prev.socials,
    tracks: parsed.artist.tracks !== undefined ? (parsed.artist.tracks ?? []) : prev.tracks,
    status: parsed.artist.status ?? prev.status ?? "active",
    createdAt: prev.createdAt || nowIso(),
    updatedAt: nowIso(),
  };

  store.artists[idx] = next;
  await saveStore(store);

  res.json({ success: true, message: "Artist replaced.", artist: next, updatedAt: store.updatedAt });
});

/* -----------------------------
 * PATCH endpoints
 * ----------------------------- */
router.patch("/:id", async (req, res) => {
  const id = normalizeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: "Invalid id." });

  const parsed = normalizeArtistPayload(req.body, { requireId: false });
  if (!parsed.ok) return res.status(400).json({ success: false, message: parsed.error });

  const store = await loadStore();
  const idx = store.artists.findIndex((a) => a.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Artist not found." });

  const prev = store.artists[idx];

  const next = {
    ...prev,
    ...parsed.artist,
    id,
    socials: parsed.artist.socials !== undefined ? (parsed.artist.socials ?? prev.socials) : prev.socials,
    tracks: parsed.artist.tracks !== undefined ? (parsed.artist.tracks ?? prev.tracks) : prev.tracks,
    updatedAt: nowIso(),
  };

  store.artists[idx] = next;
  await saveStore(store);

  res.json({ success: true, message: "Artist updated.", artist: next, updatedAt: store.updatedAt });
});

/* -----------------------------
 * DELETE endpoints
 * ----------------------------- */
router.delete("/:id", async (req, res) => {
  const id = normalizeId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: "Invalid id." });

  const store = await loadStore();
  const before = store.artists.length;
  store.artists = store.artists.filter((a) => a.id !== id);

  if (store.artists.length === before) {
    return res.status(404).json({ success: false, message: "Artist not found." });
  }

  await saveStore(store);
  res.json({ success: true, message: "Artist deleted.", updatedAt: store.updatedAt });
});

export default router;