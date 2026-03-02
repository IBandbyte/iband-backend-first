/**
 * ranking.js (Phase H3.1) - ESM
 * -----------------------------
 * Purpose:
 * - Provide production-safe ranking endpoints for iBand
 * - Integrate Monetisation Signals Engine into ranking score
 *
 * Notes:
 * - This backend uses temporary JSON storage before DB.
 * - We read artists from a stable data dir (Render disk) if available.
 * - We fetch monetisation score from local in-process endpoint for consistency.
 */

import express from "express";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// ----------------------------
// Config / storage
// ----------------------------
const DEFAULT_DATA_DIR = process.env.IBAND_DATA_DIR || "/var/data/iband/db";
const FALLBACK_LOCAL_DIR = path.join(__dirname, "data", "db");

const ARTISTS_FILE = process.env.IBAND_ARTISTS_FILE || "artists.json";

// Ranking tuning (Phase H3.1)
const SCORE_WEIGHTS = {
  votesWeight: 1.0, // uses artist.votes if present
  monetisationWeight: 3.0, // multiplies monetisationScore (0..100) into composite
  freshnessWeight: 0.4, // if artist.updatedAt exists
  floorVotes: 0,
  maxBoostedScore: 100000
};

// caching
const CACHE = {
  ttlMs: 12_000,
  lastAt: 0,
  lastKey: "",
  lastValue: null
};

// ----------------------------
// Helpers
// ----------------------------
function nowIso() {
  return new Date().toISOString();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

async function fileExists(p) {
  try {
    await fsp.access(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveArtistsPath() {
  const p1 = path.join(DEFAULT_DATA_DIR, ARTISTS_FILE);
  if (await fileExists(p1)) return p1;

  const p2 = path.join(FALLBACK_LOCAL_DIR, ARTISTS_FILE);
  if (await fileExists(p2)) return p2;

  // final fallback: try root
  const p3 = path.join(__dirname, ARTISTS_FILE);
  if (await fileExists(p3)) return p3;

  return p1; // return desired path even if missing (health will reflect)
}

async function readJsonSafe(p, fallback) {
  try {
    const raw = await fsp.readFile(p, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function asArrayArtists(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    // common shapes: { artists: [...] } or { items: [...] }
    if (Array.isArray(data.artists)) return data.artists;
    if (Array.isArray(data.items)) return data.items;
  }
  return [];
}

function freshnessBoost(updatedAtIso) {
  if (!updatedAtIso) return 0;
  const t = new Date(updatedAtIso).getTime();
  if (!Number.isFinite(t)) return 0;

  const ageMs = Date.now() - t;
  if (ageMs <= 0) return 1;

  // 0..1 where 0 is older than 30 days
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const norm = clamp(1 - ageDays / 30, 0, 1);
  return norm;
}

async function fetchWithTimeout(url, ms = 1500) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(to);
  }
}

function localBaseUrl(req) {
  // safest in Render: call loopback on same PORT
  const port = process.env.PORT || 10000;
  // We prefer localhost because it avoids outbound and TLS.
  return `http://127.0.0.1:${port}`;
}

async function getMonetisationScore(req, artistId, fanId = "") {
  const base = localBaseUrl(req);
  const qs = fanId ? `?fanId=${encodeURIComponent(fanId)}` : "";
  const url = `${base}/api/monetisation/score/${encodeURIComponent(artistId)}${qs}`;
  const json = await fetchWithTimeout(url, 1500);
  const score = Number(json?.monetisation?.monetisationScore ?? 0) || 0;
  return clamp(score, 0, 100);
}

function computeCompositeScore({ votes, monetisationScore, updatedAt }) {
  const v = Math.max(SCORE_WEIGHTS.floorVotes, Number(votes) || 0);
  const m = clamp(Number(monetisationScore) || 0, 0, 100);
  const f = freshnessBoost(updatedAt);

  const composite =
    v * SCORE_WEIGHTS.votesWeight +
    m * SCORE_WEIGHTS.monetisationWeight +
    f * SCORE_WEIGHTS.freshnessWeight * 100;

  return clamp(composite, 0, SCORE_WEIGHTS.maxBoostedScore);
}

// ----------------------------
// Routes
// ----------------------------

/**
 * GET /api/ranking/health
 */
router.get("/health", async (req, res) => {
  const artistsPath = await resolveArtistsPath();
  let stat = null;
  try {
    stat = await fsp.stat(artistsPath);
  } catch {
    stat = null;
  }

  return res.json({
    success: true,
    service: "ranking",
    phase: "H3.1",
    artistsFile: {
      path: artistsPath,
      ok: !!stat,
      size: stat ? stat.size : 0,
      mtimeMs: stat ? stat.mtimeMs : null
    },
    weights: SCORE_WEIGHTS,
    updatedAt: nowIso()
  });
});

/**
 * GET /api/ranking/top
 * Query:
 *  - limit (default 25, max 100)
 *  - includeMonetisation (default true)
 *  - fanId (optional: if provided, we can use affinity in the future; for now unused here)
 */
router.get("/top", async (req, res) => {
  const limit = clamp(Number(req.query.limit) || 25, 1, 100);
  const includeMonetisation = String(req.query.includeMonetisation ?? "true") !== "false";

  // cache key
  const cacheKey = `top|${limit}|${includeMonetisation}`;
  const now = Date.now();
  if (CACHE.lastValue && CACHE.lastKey === cacheKey && now - CACHE.lastAt < CACHE.ttlMs) {
    return res.json({ ...CACHE.lastValue, cache: { hit: true, ttlMs: CACHE.ttlMs } });
  }

  const artistsPath = await resolveArtistsPath();
  const raw = await readJsonSafe(artistsPath, []);
  const artists = asArrayArtists(raw);

  // compute base fields first
  const baseRows = artists.map((a) => {
    const id = (a.id || a.artistId || a.slug || "").toString();
    const votes = Number(a.votes ?? a.voteCount ?? 0) || 0;
    const updatedAt = a.updatedAt || a.lastActiveAt || a.modifiedAt || null;

    return {
      id,
      name: a.name || a.artistName || id,
      genre: a.genre || a.primaryGenre || "",
      location: a.location || "",
      imageUrl: a.imageUrl || a.image || "",
      votes,
      updatedAt,
      _raw: a
    };
  }).filter((x) => x.id);

  // add monetisation scores (sequential for reliability; small N)
  const rows = [];
  for (const r of baseRows) {
    const monetisationScore = includeMonetisation ? await getMonetisationScore(req, r.id) : 0;
    const compositeScore = computeCompositeScore({
      votes: r.votes,
      monetisationScore,
      updatedAt: r.updatedAt
    });

    rows.push({
      id: r.id,
      name: r.name,
      genre: r.genre,
      location: r.location,
      imageUrl: r.imageUrl,
      votes: r.votes,
      monetisationScore,
      compositeScore,
      updatedAt: r.updatedAt
    });
  }

  rows.sort((a, b) => b.compositeScore - a.compositeScore);

  const payload = {
    success: true,
    list: rows.slice(0, limit),
    meta: {
      limit,
      includeMonetisation,
      scored: rows.length,
      updatedAt: nowIso()
    },
    cache: { hit: false, ttlMs: CACHE.ttlMs }
  };

  CACHE.lastAt = now;
  CACHE.lastKey = cacheKey;
  CACHE.lastValue = payload;

  return res.json(payload);
});

/**
 * GET /api/ranking/artist/:artistId
 * Returns the artist rank row and nearby context.
 * Query:
 *  - window (default 3)
 *  - includeMonetisation (default true)
 */
router.get("/artist/:artistId", async (req, res) => {
  const artistId = (req.params.artistId || "").toString().trim();
  if (!artistId) return res.status(400).json({ success: false, error: "missing_artistId" });

  const window = clamp(Number(req.query.window) || 3, 1, 10);
  const includeMonetisation = String(req.query.includeMonetisation ?? "true") !== "false";

  const artistsPath = await resolveArtistsPath();
  const raw = await readJsonSafe(artistsPath, []);
  const artists = asArrayArtists(raw);

  const baseRows = artists.map((a) => {
    const id = (a.id || a.artistId || a.slug || "").toString();
    const votes = Number(a.votes ?? a.voteCount ?? 0) || 0;
    const updatedAt = a.updatedAt || a.lastActiveAt || a.modifiedAt || null;

    return { id, name: a.name || id, votes, updatedAt };
  }).filter((x) => x.id);

  const rows = [];
  for (const r of baseRows) {
    const monetisationScore = includeMonetisation ? await getMonetisationScore(req, r.id) : 0;
    const compositeScore = computeCompositeScore({
      votes: r.votes,
      monetisationScore,
      updatedAt: r.updatedAt
    });
    rows.push({ ...r, monetisationScore, compositeScore });
  }

  rows.sort((a, b) => b.compositeScore - a.compositeScore);

  const idx = rows.findIndex((x) => x.id === artistId);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: "artist_not_found", artistId });
  }

  const start = Math.max(0, idx - window);
  const end = Math.min(rows.length, idx + window + 1);

  return res.json({
    success: true,
    artistId,
    rank: idx + 1,
    total: rows.length,
    row: rows[idx],
    around: rows.slice(start, end),
    meta: { window, includeMonetisation, updatedAt: nowIso() }
  });
});

export default router;