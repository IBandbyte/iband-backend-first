/**
 * medals.js (root) — ESM default export
 * iBand Medal Engine (v1)
 *
 * Goal:
 * - Assign an artist badge tier (Certified / Bronze / Silver / Gold / Unranked)
 * - Based on percentile rank of a stable popularity score (bucket metrics from events-agg.json)
 * - SAFE: read-only; does not modify ranking or events
 *
 * Data sources:
 * - events-agg.json (authoritative engagement buckets)
 * - artists.json (authoritative “who is an artist on the platform” list)
 *
 * Endpoints:
 * - GET  /api/medals/health
 * - GET  /api/medals/artist/:artistId
 * - GET  /api/medals/leaderboard?limit=50
 */

import express from "express";
import fs from "fs/promises";
import path from "path";

const router = express.Router();

// -------------------- Paths / Env --------------------
const DATA_DIR = process.env.DATA_DIR || "/var/data/iband/db";
const EVENTS_AGG_FILE =
  process.env.EVENTS_AGG_FILE || path.join(DATA_DIR, "events-agg.json");

// Artists file (created by artists.js service)
const ARTISTS_FILE_ENV = process.env.ARTISTS_FILE || path.join(DATA_DIR, "artists.json");

// -------------------- Scoring / Tiers --------------------
// Keep consistent with ranking weights (defaults match your ranking config)
const WATCHMS_PER_POINT = parseInt(process.env.RISING_WATCHMS_PER_POINT || "10000", 10);

const W_VIEW = parseFloat(process.env.RISING_W_VIEW || "1.0");
const W_REPLAY = parseFloat(process.env.RISING_W_REPLAY || "2.5");
const W_LIKE = parseFloat(process.env.RISING_W_LIKE || "1.5");
const W_SAVE = parseFloat(process.env.RISING_W_SAVE || "3.5");
const W_SHARE = parseFloat(process.env.RISING_W_SHARE || "4.5");
const W_FOLLOW = parseFloat(process.env.RISING_W_FOLLOW || "5.0");
const W_COMMENT = parseFloat(process.env.RISING_W_COMMENT || "2.0");
const W_VOTE = parseFloat(process.env.RISING_W_VOTE || "1.0");

// “Trending” freshness floor concept: we *optionally* apply a mild floor
// For medals, this makes tiers stable day-to-day (prevents “everyone turns black overnight”)
const FRESHNESS_FLOOR = parseFloat(process.env.MEDALS_FRESHNESS_FLOOR || "0.65");

// Tier percentile thresholds (tunable)
const GOLD_PCT = parseFloat(process.env.MEDALS_GOLD_PCT || "0.05");     // top 5%
const SILVER_PCT = parseFloat(process.env.MEDALS_SILVER_PCT || "0.20"); // next 15% (5%..20%)
const BRONZE_PCT = parseFloat(process.env.MEDALS_BRONZE_PCT || "0.50"); // next 30% (20%..50%)

// Cache (small TTL keeps it fast on Render)
const CACHE_TTL_MS = parseInt(process.env.MEDALS_CACHE_TTL_MS || "30000", 10);
const MAX_RETURN = parseInt(process.env.MEDALS_MAX_RETURN || "50", 10);

const routerVersion = 1;

// -------------------- Utils --------------------
function nowIso() {
  return new Date().toISOString();
}

function safeNumber(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

async function statSafe(p) {
  try {
    const s = await fs.stat(p);
    return { ok: true, size: s.size, mtimeMs: s.mtimeMs };
  } catch (e) {
    return { ok: false, error: e?.code || String(e) };
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

function normalizeArtistsFile(obj) {
  // Expected:
  // { version, updatedAt, artists: [ {id,...}, ... ] }
  // Fallback-safe for older shapes
  const out = { version: 1, updatedAt: null, artists: [] };

  if (!obj || typeof obj !== "object") return out;

  if (Array.isArray(obj.artists)) out.artists = obj.artists;
  else if (Array.isArray(obj)) out.artists = obj;

  out.version = safeNumber(obj.version, 1);
  out.updatedAt = obj.updatedAt || null;
  return out;
}

function computeWeightedFromBucket(bucket) {
  const views = safeNumber(bucket?.views, 0);
  const replays = safeNumber(bucket?.replays, 0);
  const likes = safeNumber(bucket?.likes, 0);
  const saves = safeNumber(bucket?.saves, 0);
  const shares = safeNumber(bucket?.shares, 0);
  const follows = safeNumber(bucket?.follows, 0);
  const comments = safeNumber(bucket?.comments, 0);
  const votes = safeNumber(bucket?.votes, 0);
  const watchMs = safeNumber(bucket?.watchMs, 0);

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

  return {
    weighted: Number(weighted.toFixed(6)),
    watchPoints: Number(watchPoints.toFixed(6)),
  };
}

// Medal score is “stable trending-like”:
// score = weighted * max(freshnessFloor, rawFreshness)
function computeMedalScore(bucket) {
  const lastAt = bucket?.lastAt || null;

  // raw freshness (half-life approach), but medals clamp with a floor for stability
  // We keep it simple and stable here: if lastAt exists, rawFreshness < 1; else 1.
  // (True decay stays in ranking.js; medals just need stable tiers.)
  let rawFreshness = 1;
  if (lastAt) {
    const ageMs = Date.now() - Date.parse(lastAt);
    if (Number.isFinite(ageMs) && ageMs > 0) {
      // mild 24h half-life approximation (matches your ranking default)
      const halfLifeHours = 24;
      const ageH = ageMs / (1000 * 60 * 60);
      rawFreshness = Math.pow(0.5, ageH / Math.max(1, halfLifeHours));
      rawFreshness = clamp(rawFreshness, 0.05, 1.0);
    }
  }

  const appliedFreshness = Math.max(FRESHNESS_FLOOR, rawFreshness);
  const { weighted, watchPoints } = computeWeightedFromBucket(bucket);
  const score = weighted * appliedFreshness;

  return {
    score: Number(score.toFixed(6)),
    explain: {
      weighted,
      rawFreshness: Number(rawFreshness.toFixed(6)),
      appliedFreshness: Number(appliedFreshness.toFixed(6)),
      floor: FRESHNESS_FLOOR,
      watchPoints,
      lastAt: lastAt || null,
    },
  };
}

function tierFromPercentile(pct01) {
  // pct01 is 0..1 where 0 is top rank
  if (pct01 <= GOLD_PCT) return "gold";
  if (pct01 <= SILVER_PCT) return "silver";
  if (pct01 <= BRONZE_PCT) return "bronze";
  return "certified";
}

function tierMeta(tier) {
  // These are UI hints; frontend can ignore/override
  if (tier === "gold") {
    return { tier, label: "Gold", emoji: "🥇", hex: "#D4AF37" };
  }
  if (tier === "silver") {
    return { tier, label: "Silver", emoji: "🥈", hex: "#C0C0C0" };
  }
  if (tier === "bronze") {
    return { tier, label: "Bronze", emoji: "🥉", hex: "#CD7F32" };
  }
  if (tier === "certified") {
    return { tier, label: "Certified", emoji: "✅", hex: "#6A5ACD" }; // purple-ish “starter certified”
  }
  return { tier: "unranked", label: "Unranked", emoji: "⚫️", hex: "#111111" };
}

// -------------------- Cached Build --------------------
let _cache = {
  atMs: 0,
  aggUpdatedAt: null,
  artistsUpdatedAt: null,
  // core
  scoredRows: [], // [{artistId, score, explain}]
  rankIndex: new Map(), // artistId -> {rank, total, percentile01}
  // debug meta
  sources: {},
};

async function buildCacheIfNeeded() {
  const now = Date.now();
  if (_cache.atMs && now - _cache.atMs < CACHE_TTL_MS && _cache.scoredRows.length) {
    return _cache;
  }

  // Load events-agg
  const aggBase = { version: 1, updatedAt: null, byArtist: {}, last100: [] };
  const agg = await readJsonSafe(EVENTS_AGG_FILE, aggBase);
  if (!agg || typeof agg !== "object") {
    agg.byArtist = {};
    agg.updatedAt = null;
  }
  if (!agg.byArtist || typeof agg.byArtist !== "object") agg.byArtist = {};

  // Load artists list (optional but recommended for “Certified” baseline)
  const artistsRaw = await readJsonSafe(ARTISTS_FILE_ENV, null);
  const artists = normalizeArtistsFile(artistsRaw);
  const artistIdsFromProfiles = new Set(
    (artists.artists || [])
      .map((a) => String(a?.id || "").trim())
      .filter(Boolean)
  );

  // Score only artists that exist on platform (artists.json) OR have agg bucket
  const scored = [];
  const allIds = new Set([
    ...Object.keys(agg.byArtist || {}),
    ...Array.from(artistIdsFromProfiles),
  ]);

  for (const artistId of allIds) {
    const bucket = agg.byArtist?.[artistId] || null;

    // If they have no bucket and also no profile, ignore completely
    const hasProfile = artistIdsFromProfiles.has(artistId);
    if (!bucket && !hasProfile) continue;

    // If they have profile but zero activity, treat as “Certified baseline” (score 0)
    if (!bucket) {
      scored.push({
        artistId,
        score: 0,
        explain: {
          weighted: 0,
          rawFreshness: 1,
          appliedFreshness: 1,
          floor: FRESHNESS_FLOOR,
          watchPoints: 0,
          lastAt: null,
          note: "No engagement yet (profile exists).",
        },
      });
      continue;
    }

    const ms = computeMedalScore(bucket);
    scored.push({
      artistId,
      score: ms.score,
      explain: ms.explain,
    });
  }

  // Sort by score desc (stable tie-breaker: artistId)
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.artistId).localeCompare(String(b.artistId));
  });

  // Rank index (percentile: 0 is best)
  const total = scored.length || 1;
  const rankIndex = new Map();
  for (let i = 0; i < scored.length; i++) {
    const pct01 = total <= 1 ? 0 : i / (total - 1);
    rankIndex.set(scored[i].artistId, {
      rank: i + 1,
      total,
      percentile01: Number(pct01.toFixed(6)),
    });
  }

  // sources stats for health
  const eventsAggStat = await statSafe(EVENTS_AGG_FILE);
  const artistsStat = await statSafe(ARTISTS_FILE_ENV);

  _cache = {
    atMs: now,
    aggUpdatedAt: agg.updatedAt || null,
    artistsUpdatedAt: artists.updatedAt || null,
    scoredRows: scored,
    rankIndex,
    sources: {
      dataDir: DATA_DIR,
      eventsAgg: { path: EVENTS_AGG_FILE, stat: eventsAggStat },
      artistsFile: { path: ARTISTS_FILE_ENV, stat: artistsStat },
      artistsLoaded: artistIdsFromProfiles.size,
      totalConsidered: scored.length,
      cacheTtlMs: CACHE_TTL_MS,
    },
  };

  return _cache;
}

// -------------------- Routes --------------------
router.use(express.json({ limit: "64kb" }));

router.get("/health", async (_req, res) => {
  const cache = await buildCacheIfNeeded();

  return res.json({
    success: true,
    service: "medals",
    version: routerVersion,
    updatedAt: nowIso(),
    config: {
      maxReturn: MAX_RETURN,
      cacheTtlMs: CACHE_TTL_MS,
      weights: {
        view: W_VIEW,
        replay: W_REPLAY,
        like: W_LIKE,
        save: W_SAVE,
        share: W_SHARE,
        follow: W_FOLLOW,
        comment: W_COMMENT,
        vote: W_VOTE,
      },
      watchMsPerPoint: WATCHMS_PER_POINT,
      freshnessFloor: FRESHNESS_FLOOR,
      tiers: {
        goldTopPct: GOLD_PCT,
        silverTopPct: SILVER_PCT,
        bronzeTopPct: BRONZE_PCT,
        certifiedRest: true,
        unrankedWhenMissingProfile: true,
      },
    },
    sources: cache.sources,
    aggUpdatedAt: cache.aggUpdatedAt,
    artistsUpdatedAt: cache.artistsUpdatedAt,
  });
});

router.get("/artist/:artistId", async (req, res) => {
  const artistId = String(req.params.artistId || "").trim();
  if (!artistId) {
    return res.status(400).json({ success: false, message: "artistId is required." });
  }

  const cache = await buildCacheIfNeeded();
  const idx = cache.rankIndex.get(artistId);

  // If not found at all, they’re not a platform artist and have no activity
  if (!idx) {
    return res.status(404).json({
      success: false,
      message: "No medal data for this artist.",
      artistId,
      medal: tierMeta("unranked"),
    });
  }

  const row = cache.scoredRows.find((r) => r.artistId === artistId);
  const pct01 = idx.percentile01;
  const tier = row?.score > 0 ? tierFromPercentile(pct01) : "certified";

  return res.json({
    success: true,
    updatedAt: cache.aggUpdatedAt || cache.artistsUpdatedAt || null,
    artistId,
    score: row?.score ?? 0,
    rank: idx.rank,
    total: idx.total,
    percentile01: pct01, // 0=best
    medal: tierMeta(tier),
    explain: {
      basis: "stable-trending-like (bucket weighted * freshness floor)",
      scoreExplain: row?.explain || null,
      thresholds: { goldTopPct: GOLD_PCT, silverTopPct: SILVER_PCT, bronzeTopPct: BRONZE_PCT },
    },
  });
});

router.get("/leaderboard", async (req, res) => {
  const limit = clamp(parseInt(req.query.limit || `${MAX_RETURN}`, 10) || MAX_RETURN, 1, MAX_RETURN);
  const cache = await buildCacheIfNeeded();

  const out = [];
  for (const row of cache.scoredRows.slice(0, limit)) {
    const idx = cache.rankIndex.get(row.artistId);
    const pct01 = idx?.percentile01 ?? 1;
    const tier = row.score > 0 ? tierFromPercentile(pct01) : "certified";

    out.push({
      artistId: row.artistId,
      score: row.score,
      rank: idx?.rank ?? null,
      percentile01: pct01,
      medal: tierMeta(tier),
      lastAt: row?.explain?.lastAt || null,
    });
  }

  return res.json({
    success: true,
    updatedAt: cache.aggUpdatedAt || cache.artistsUpdatedAt || null,
    count: out.length,
    results: out,
  });
});

export default router;