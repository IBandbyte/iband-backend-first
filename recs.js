/**
 * recs.js (Phase H3.1) - ESM
 * --------------------------
 * Purpose:
 * - Provide recommendation/feed endpoints
 * - Incorporate monetisation score + fan affinity into ranking for discovery
 *
 * Endpoints:
 * - GET /api/recs/health
 * - GET /api/recs/feed?fanId=&limit=&includeMonetisation=true
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

const FEED = {
  maxLimit: 60,
  defaultLimit: 25,
  // weights for feed score
  votesWeight: 1.0,
  monetisationWeight: 2.2,
  affinityWeight: 1.4,
  freshnessWeight: 0.35
};

// caching
const CACHE = {
  ttlMs: 10_000,
  map: new Map() // key -> { at, value }
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

  const p3 = path.join(__dirname, ARTISTS_FILE);
  if (await fileExists(p3)) return p3;

  return p1;
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

  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return clamp(1 - ageDays / 21, 0, 1);
}

async function fetchWithTimeout(url, ms = 1600) {
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

function localBaseUrl() {
  const port = process.env.PORT || 10000;
  return `http://127.0.0.1:${port}`;
}

async function getMonetisation(req, artistId, fanId) {
  const base = localBaseUrl();
  const qs = fanId ? `?fanId=${encodeURIComponent(fanId)}` : "";
  const url = `${base}/api/monetisation/score/${encodeURIComponent(artistId)}${qs}`;
  const json = await fetchWithTimeout(url, 1600);

  const monetisationScore = clamp(Number(json?.monetisation?.monetisationScore ?? 0) || 0, 0, 100);
  const affinityScore = clamp(Number(json?.fan?.fanAffinityScore ?? 0) || 0, 0, 100);

  return { monetisationScore, affinityScore };
}

function computeFeedScore({ votes, monetisationScore, affinityScore, updatedAt }) {
  const v = Number(votes) || 0;
  const m = clamp(Number(monetisationScore) || 0, 0, 100);
  const a = clamp(Number(affinityScore) || 0, 0, 100);
  const f = freshnessBoost(updatedAt);

  const score =
    v * FEED.votesWeight +
    m * FEED.monetisationWeight +
    a * FEED.affinityWeight +
    f * FEED.freshnessWeight * 100;

  return clamp(score, 0, 100000);
}

function diversify(list) {
  // light diversity pass: avoid 10 same-genre in a row
  const out = [];
  const genreCounts = new Map();

  for (const item of list) {
    const g = (item.genre || "").toLowerCase();
    const c = genreCounts.get(g) || 0;
    // soft cap per genre
    if (c >= 8) continue;
    genreCounts.set(g, c + 1);
    out.push(item);
  }
  return out;
}

// ----------------------------
// Routes
// ----------------------------

/**
 * GET /api/recs/health
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
    service: "recs",
    phase: "H3.1",
    artistsFile: {
      path: artistsPath,
      ok: !!stat,
      size: stat ? stat.size : 0,
      mtimeMs: stat ? stat.mtimeMs : null
    },
    weights: FEED,
    cache: { ttlMs: CACHE.ttlMs },
    updatedAt: nowIso()
  });
});

/**
 * GET /api/recs/feed
 * Query:
 *  - fanId (optional)
 *  - limit (default 25, max 60)
 *  - includeMonetisation (default true)
 */
router.get("/feed", async (req, res) => {
  const fanId = (req.query.fanId || "").toString().trim();
  const limit = clamp(Number(req.query.limit) || FEED.defaultLimit, 1, FEED.maxLimit);
  const includeMonetisation = String(req.query.includeMonetisation ?? "true") !== "false";

  const cacheKey = `feed|${fanId || "anon"}|${limit}|${includeMonetisation}`;
  const hit = CACHE.map.get(cacheKey);
  const now = Date.now();

  if (hit && now - hit.at < CACHE.ttlMs) {
    return res.json({ ...hit.value, cache: { hit: true, ttlMs: CACHE.ttlMs } });
  }

  const artistsPath = await resolveArtistsPath();
  const raw = await readJsonSafe(artistsPath, []);
  const artists = asArrayArtists(raw);

  const baseRows = artists
    .map((a) => {
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
        updatedAt
      };
    })
    .filter((x) => x.id);

  const rows = [];
  for (const r of baseRows) {
    const { monetisationScore, affinityScore } = includeMonetisation
      ? await getMonetisation(req, r.id, fanId)
      : { monetisationScore: 0, affinityScore: 0 };

    const feedScore = computeFeedScore({
      votes: r.votes,
      monetisationScore,
      affinityScore,
      updatedAt: r.updatedAt
    });

    rows.push({
      ...r,
      monetisationScore,
      affinityScore,
      feedScore
    });
  }

  rows.sort((a, b) => b.feedScore - a.feedScore);

  const diversified = diversify(rows).slice(0, limit);

  const payload = {
    success: true,
    feed: diversified,
    meta: {
      fanId: fanId || null,
      limit,
      includeMonetisation,
      scored: rows.length,
      updatedAt: nowIso()
    },
    cache: { hit: false, ttlMs: CACHE.ttlMs }
  };

  CACHE.map.set(cacheKey, { at: now, value: payload });

  return res.json(payload);
});

export default router;