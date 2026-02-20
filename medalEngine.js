/**
 * medalEngine.js — Pure Medal Logic Core (Reusable)
 *
 * No Express.
 * No routing.
 * Pure scoring + tier assignment.
 *
 * Used by:
 * - medals.js
 * - recs.js (next step)
 */

import fs from "fs/promises";
import path from "path";

// -------------------- ENV --------------------
const DATA_DIR = process.env.DATA_DIR || "/var/data/iband/db";
const EVENTS_AGG_FILE =
  process.env.EVENTS_AGG_FILE || path.join(DATA_DIR, "events-agg.json");
const ARTISTS_FILE =
  process.env.ARTISTS_FILE || path.join(DATA_DIR, "artists.json");

// Ranking weight alignment
const WATCHMS_PER_POINT = parseInt(process.env.RISING_WATCHMS_PER_POINT || "10000", 10);

const W_VIEW = parseFloat(process.env.RISING_W_VIEW || "1.0");
const W_REPLAY = parseFloat(process.env.RISING_W_REPLAY || "2.5");
const W_LIKE = parseFloat(process.env.RISING_W_LIKE || "1.5");
const W_SAVE = parseFloat(process.env.RISING_W_SAVE || "3.5");
const W_SHARE = parseFloat(process.env.RISING_W_SHARE || "4.5");
const W_FOLLOW = parseFloat(process.env.RISING_W_FOLLOW || "5.0");
const W_COMMENT = parseFloat(process.env.RISING_W_COMMENT || "2.0");
const W_VOTE = parseFloat(process.env.RISING_W_VOTE || "1.0");

// Tier thresholds
const GOLD_PCT = parseFloat(process.env.MEDALS_GOLD_PCT || "0.05");
const SILVER_PCT = parseFloat(process.env.MEDALS_SILVER_PCT || "0.20");
const BRONZE_PCT = parseFloat(process.env.MEDALS_BRONZE_PCT || "0.50");

// Stability floor
const FRESHNESS_FLOOR = parseFloat(process.env.MEDALS_FRESHNESS_FLOOR || "0.65");

// Cache
const CACHE_TTL_MS = 30000;

let _cache = {
  atMs: 0,
  scored: [],
  rankIndex: new Map(),
};

// -------------------- Utilities --------------------
function safeNumber(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

async function readJsonSafe(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// -------------------- Core Scoring --------------------
function computeWeighted(bucket) {
  const watchPoints =
    safeNumber(bucket?.watchMs, 0) / Math.max(1000, WATCHMS_PER_POINT);

  const weighted =
    safeNumber(bucket?.views, 0) * W_VIEW +
    safeNumber(bucket?.replays, 0) * W_REPLAY +
    safeNumber(bucket?.likes, 0) * W_LIKE +
    safeNumber(bucket?.saves, 0) * W_SAVE +
    safeNumber(bucket?.shares, 0) * W_SHARE +
    safeNumber(bucket?.follows, 0) * W_FOLLOW +
    safeNumber(bucket?.comments, 0) * W_COMMENT +
    safeNumber(bucket?.votes, 0) * W_VOTE +
    watchPoints;

  return weighted;
}

function computeScore(bucket) {
  if (!bucket) return 0;

  let rawFreshness = 1;
  if (bucket.lastAt) {
    const ageMs = Date.now() - Date.parse(bucket.lastAt);
    if (Number.isFinite(ageMs) && ageMs > 0) {
      const halfLifeHours = 24;
      const ageH = ageMs / (1000 * 60 * 60);
      rawFreshness = Math.pow(0.5, ageH / halfLifeHours);
      rawFreshness = clamp(rawFreshness, 0.05, 1);
    }
  }

  const appliedFreshness = Math.max(FRESHNESS_FLOOR, rawFreshness);
  return computeWeighted(bucket) * appliedFreshness;
}

function tierFromPercentile(pct01, score) {
  if (score <= 0) return "certified";
  if (pct01 <= GOLD_PCT) return "gold";
  if (pct01 <= SILVER_PCT) return "silver";
  if (pct01 <= BRONZE_PCT) return "bronze";
  return "certified";
}

function tierMeta(tier) {
  if (tier === "gold") {
    return { tier, label: "Gold", emoji: "🥇", hex: "#D4AF37" };
  }
  if (tier === "silver") {
    return { tier, label: "Silver", emoji: "🥈", hex: "#C0C0C0" };
  }
  if (tier === "bronze") {
    return { tier, label: "Bronze", emoji: "🥉", hex: "#CD7F32" };
  }
  return { tier: "certified", label: "Certified", emoji: "✅", hex: "#6A5ACD" };
}

// -------------------- Cache Builder --------------------
async function buildCacheIfNeeded() {
  const now = Date.now();
  if (_cache.atMs && now - _cache.atMs < CACHE_TTL_MS) {
    return _cache;
  }

  const agg = await readJsonSafe(EVENTS_AGG_FILE, { byArtist: {} });
  const artistsRaw = await readJsonSafe(ARTISTS_FILE, { artists: [] });

  const artistIds = new Set([
    ...Object.keys(agg.byArtist || {}),
    ...(artistsRaw.artists || []).map((a) => a.id),
  ]);

  const scored = [];

  for (const id of artistIds) {
    const bucket = agg.byArtist?.[id] || null;
    const score = computeScore(bucket);
    scored.push({ artistId: id, score });
  }

  scored.sort((a, b) => b.score - a.score);

  const rankIndex = new Map();
  const total = scored.length || 1;

  for (let i = 0; i < scored.length; i++) {
    const pct01 = total <= 1 ? 0 : i / (total - 1);
    rankIndex.set(scored[i].artistId, {
      rank: i + 1,
      total,
      percentile01: pct01,
    });
  }

  _cache = { atMs: now, scored, rankIndex };
  return _cache;
}

// -------------------- Public API --------------------
export async function getMedalForArtist(artistId) {
  const cache = await buildCacheIfNeeded();
  const idx = cache.rankIndex.get(artistId);

  if (!idx) {
    return tierMeta("certified");
  }

  const row = cache.scored.find((r) => r.artistId === artistId);
  const tier = tierFromPercentile(idx.percentile01, row?.score ?? 0);

  return tierMeta(tier);
}