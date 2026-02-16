/**
 * recs.js (root) — ESM default export
 * iBand Feed Generator (v3 — enriched + debug-safe)
 *
 * Adds:
 * - Health reports which artists file is used + how many loaded
 * - Rising response includes artistsLoaded (debug-safe) so we never guess
 * - Robust artist store parsing (supports {artists:[...]} or {data:{artists:[...]}})
 */

import express from "express";
import fs from "fs/promises";
import path from "path";

const router = express.Router();

/* -----------------------------
 * Config
 * ----------------------------- */
const DATA_DIR = process.env.DATA_DIR || "/var/data/iband/db";
const EVENTS_AGG_FILE =
  process.env.EVENTS_AGG_FILE || path.join(DATA_DIR, "events-agg.json");
const ARTISTS_FILE =
  process.env.ARTISTS_FILE || path.join(DATA_DIR, "artists.json");

const MAX_RETURN = parseInt(process.env.RECS_MAX_RETURN || "50", 10);
const routerVersion = 3;

/* -----------------------------
 * Helpers
 * ----------------------------- */
function nowIso() {
  return new Date().toISOString();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function safeNumber(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJsonSafe(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function loadAgg() {
  const base = { updatedAt: null, byArtist: {} };
  const agg = await readJsonSafe(EVENTS_AGG_FILE, base);
  if (!agg || typeof agg !== "object") return base;
  if (!agg.byArtist || typeof agg.byArtist !== "object") agg.byArtist = {};
  return agg;
}

function extractArtistsArray(store) {
  // supports multiple shapes safely
  if (!store || typeof store !== "object") return [];
  if (Array.isArray(store.artists)) return store.artists;
  if (store.data && Array.isArray(store.data.artists)) return store.data.artists;
  return [];
}

async function loadArtistsMap() {
  const base = { artists: [] };
  const store = await readJsonSafe(ARTISTS_FILE, base);
  const arr = extractArtistsArray(store);

  const map = {};
  for (const a of arr) {
    if (a && typeof a === "object" && typeof a.id === "string" && a.id.trim()) {
      map[a.id.trim()] = a;
    }
  }

  return { map, count: Object.keys(map).length };
}

/* -----------------------------
 * Rising score (same as ranking v2)
 * ----------------------------- */
function risingScoreFromBucket(bucket) {
  const W_VIEW = 1.0;
  const W_REPLAY = 2.5;
  const W_LIKE = 1.5;
  const W_SAVE = 3.5;
  const W_SHARE = 4.5;
  const W_FOLLOW = 5.0;
  const W_COMMENT = 2.0;
  const W_VOTE = 1.0;

  const WATCHMS_PER_POINT = 10000;
  const HALF_LIFE_HOURS = 24;

  const views = safeNumber(bucket.views);
  const replays = safeNumber(bucket.replays);
  const likes = safeNumber(bucket.likes);
  const saves = safeNumber(bucket.saves);
  const shares = safeNumber(bucket.shares);
  const follows = safeNumber(bucket.follows);
  const comments = safeNumber(bucket.comments);
  const votes = safeNumber(bucket.votes);
  const watchMs = safeNumber(bucket.watchMs);

  const watchPoints = watchMs / Math.max(1000, WATCHMS_PER_POINT);

  const weighted =
    views * W_VIEW +
    replays * W_REPLAY +
    likes * W_LIKE +
    saves * W_SAVE +
    shares * W_SHARE +
    follows * W_FOLLOW +
    comments * W_COMMENT +
    votes * W_VOTE +
    watchPoints;

  let freshness = 1.0;
  if (bucket.lastAt) {
    const ageMs = Date.now() - Date.parse(bucket.lastAt);
    if (Number.isFinite(ageMs)) {
      const ageH = ageMs / (1000 * 60 * 60);
      freshness = Math.pow(0.5, ageH / HALF_LIFE_HOURS);
      freshness = clamp(freshness, 0.05, 1.0);
    }
  }

  return Number((weighted * freshness).toFixed(6));
}

/* -----------------------------
 * Middleware
 * ----------------------------- */
router.use(express.json({ limit: "64kb" }));

/* -----------------------------
 * Endpoints
 * ----------------------------- */
router.get("/health", async (_req, res) => {
  const artistsExists = await fileExists(ARTISTS_FILE);
  const { count: artistsLoaded } = await loadArtistsMap();

  res.json({
    success: true,
    service: "recs",
    version: routerVersion,
    enriched: true,
    updatedAt: nowIso(),
    sources: {
      eventsAgg: path.basename(EVENTS_AGG_FILE),
      artistsFile: path.basename(ARTISTS_FILE),
      artistsFileExists: artistsExists,
      artistsLoaded,
    },
    maxReturn: MAX_RETURN,
  });
});

/**
 * GET /api/recs/rising?limit=20
 * Enriched feed
 */
router.get("/rising", async (req, res) => {
  const limit = clamp(
    parseInt(req.query.limit || `${MAX_RETURN}`, 10) || MAX_RETURN,
    1,
    MAX_RETURN
  );

  const agg = await loadAgg();
  const { map: artistMap, count: artistsLoaded } = await loadArtistsMap();

  const rows = [];

  for (const [artistIdRaw, bucket] of Object.entries(agg.byArtist || {})) {
    const artistId = String(artistIdRaw || "").trim();
    const score = risingScoreFromBucket(bucket);
    const artist = artistMap[artistId] || null;

    rows.push({
      artist: artist
        ? {
            id: artist.id,
            name: artist.name || null,
            imageUrl: artist.imageUrl || null,
            genre: artist.genre || null,
            location: artist.location || null,
          }
        : { id: artistId },
      score,
      lastAt: bucket.lastAt || null,
      metrics: {
        views: safeNumber(bucket.views),
        replays: safeNumber(bucket.replays),
        watchMs: safeNumber(bucket.watchMs),
      },
    });
  }

  rows.sort((a, b) => b.score - a.score);

  res.json({
    success: true,
    updatedAt: agg.updatedAt || null,
    artistsLoaded,
    count: rows.length,
    results: rows.slice(0, limit),
  });
});

export default router;