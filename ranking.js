/**
 * ranking.js (root) — ESM default export
 * iBand Algorithm Brain (v1.1)
 *
 * Change:
 * - Use artist bucket metrics as the primary scoring source (stable + always current)
 * - Use bucket.lastAt for freshness (authoritative)
 * - Treat last100 as debug only (not required for correctness)
 */

import express from "express";
import fs from "fs/promises";
import path from "path";

const router = express.Router();

const DATA_DIR = process.env.DATA_DIR || "/var/data/iband/db";
const EVENTS_AGG_FILE = process.env.EVENTS_AGG_FILE || path.join(DATA_DIR, "events-agg.json");

const RISING_HALF_LIFE_HOURS = parseFloat(process.env.RISING_HALF_LIFE_HOURS || "24");
const RISING_WATCHMS_PER_POINT = parseInt(process.env.RISING_WATCHMS_PER_POINT || "10000", 10);

// Weights (tunable)
const W_VIEW = parseFloat(process.env.RISING_W_VIEW || "1.0");
const W_REPLAY = parseFloat(process.env.RISING_W_REPLAY || "2.5");
const W_LIKE = parseFloat(process.env.RISING_W_LIKE || "1.5");
const W_SAVE = parseFloat(process.env.RISING_W_SAVE || "3.5");
const W_SHARE = parseFloat(process.env.RISING_W_SHARE || "4.5");
const W_FOLLOW = parseFloat(process.env.RISING_W_FOLLOW || "5.0");
const W_COMMENT = parseFloat(process.env.RISING_W_COMMENT || "2.0");
const W_VOTE = parseFloat(process.env.RISING_W_VOTE || "1.0");

const MAX_RETURN = parseInt(process.env.RANKING_MAX_RETURN || "50", 10);
const routerVersion = 2;

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

function hoursBetween(isoA, isoB) {
  const a = Date.parse(isoA);
  const b = Date.parse(isoB);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.abs(b - a) / (1000 * 60 * 60);
}

function decayMultiplier(lastAtIso) {
  if (!lastAtIso) return 1;
  const ageH = hoursBetween(lastAtIso, nowIso());
  if (ageH === null) return 1;

  const hl = Math.max(1, safeNumber(RISING_HALF_LIFE_HOURS, 24));
  const mult = Math.pow(0.5, ageH / hl);
  return clamp(mult, 0.05, 1.0);
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
  const base = { version: 1, updatedAt: null, byArtist: {}, last100: [] };
  const agg = await readJsonSafe(EVENTS_AGG_FILE, base);

  if (!agg || typeof agg !== "object") return base;
  if (!agg.byArtist || typeof agg.byArtist !== "object") agg.byArtist = {};
  if (!Array.isArray(agg.last100)) agg.last100 = [];
  return agg;
}

/**
 * Rising score (v1.1):
 * - Uses lifetime bucket metrics but applies freshness decay using bucket.lastAt
 * - Good enough to ship; later we’ll add true rolling windows from events.jsonl
 */
function risingScoreFromBucket(bucket) {
  const views = safeNumber(bucket.views, 0);
  const replays = safeNumber(bucket.replays, 0);
  const likes = safeNumber(bucket.likes, 0);
  const saves = safeNumber(bucket.saves, 0);
  const shares = safeNumber(bucket.shares, 0);
  const follows = safeNumber(bucket.follows, 0);
  const comments = safeNumber(bucket.comments, 0);
  const votes = safeNumber(bucket.votes, 0);
  const watchMs = safeNumber(bucket.watchMs, 0);

  const watchPoints = watchMs / Math.max(1000, RISING_WATCHMS_PER_POINT);

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

  const freshness = decayMultiplier(bucket.lastAt || null);

  // Simple velocity proxy (v1.1): newer content gets a mild boost
  // (true velocity arrives in v2 by reading jsonl)
  const velocityBoost = 1.0;

  const score = weighted * freshness * velocityBoost;

  return {
    score: Number(score.toFixed(6)),
    components: {
      weighted: Number(weighted.toFixed(6)),
      freshness: Number(freshness.toFixed(6)),
      velocityBoost: Number(velocityBoost.toFixed(6)),
      watchPoints: Number(watchPoints.toFixed(6)),
      halfLifeHours: RISING_HALF_LIFE_HOURS,
    },
  };
}

router.use(express.json({ limit: "64kb" }));

router.get("/health", async (_req, res) => {
  return res.json({
    success: true,
    service: "ranking",
    version: routerVersion,
    dataDir: DATA_DIR,
    source: path.basename(EVENTS_AGG_FILE),
    updatedAt: nowIso(),
    config: {
      halfLifeHours: RISING_HALF_LIFE_HOURS,
      watchMsPerPoint: RISING_WATCHMS_PER_POINT,
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
      maxReturn: MAX_RETURN,
      mode: "bucket-primary",
    },
  });
});

router.get("/rising", async (req, res) => {
  const limit = clamp(parseInt(req.query.limit || `${MAX_RETURN}`, 10) || MAX_RETURN, 1, MAX_RETURN);

  const agg = await loadAgg();

  const rows = [];
  for (const [artistId, bucket] of Object.entries(agg.byArtist || {})) {
    const scored = risingScoreFromBucket(bucket);

    rows.push({
      artistId,
      risingScore: scored.score,
      lastAt: bucket.lastAt || null,
      lifetime: {
        views: safeNumber(bucket.views, 0),
        replays: safeNumber(bucket.replays, 0),
        likes: safeNumber(bucket.likes, 0),
        saves: safeNumber(bucket.saves, 0),
        shares: safeNumber(bucket.shares, 0),
        follows: safeNumber(bucket.follows, 0),
        comments: safeNumber(bucket.comments, 0),
        votes: safeNumber(bucket.votes, 0),
        watchMs: safeNumber(bucket.watchMs, 0),
      },
      explain: scored.components,
    });
  }

  rows.sort((a, b) => b.risingScore - a.risingScore);

  return res.json({
    success: true,
    updatedAt: agg.updatedAt || null,
    count: rows.length,
    results: rows.slice(0, limit),
  });
});

router.get("/artist/:artistId", async (req, res) => {
  const artistId = String(req.params.artistId || "").trim();
  if (!artistId) return res.status(400).json({ success: false, message: "artistId is required." });

  const agg = await loadAgg();
  const bucket = agg.byArtist?.[artistId];
  if (!bucket) return res.status(404).json({ success: false, message: "No ranking data for this artist." });

  const scored = risingScoreFromBucket(bucket);

  return res.json({
    success: true,
    updatedAt: agg.updatedAt || null,
    artistId,
    lastAt: bucket.lastAt || null,
    risingScore: scored.score,
    lifetime: {
      views: safeNumber(bucket.views, 0),
      replays: safeNumber(bucket.replays, 0),
      likes: safeNumber(bucket.likes, 0),
      saves: safeNumber(bucket.saves, 0),
      shares: safeNumber(bucket.shares, 0),
      follows: safeNumber(bucket.follows, 0),
      comments: safeNumber(bucket.comments, 0),
      votes: safeNumber(bucket.votes, 0),
      watchMs: safeNumber(bucket.watchMs, 0),
    },
    explain: scored.components,
  });
});

export default router;