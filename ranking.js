/**
 * ranking.js (root) — ESM default export
 * iBand Algorithm Brain (v1)
 *
 * Mount in server.js:
 *   import rankingRouter from "./ranking.js";
 *   app.use("/api/ranking", rankingRouter);
 *
 * Reads events aggregates from Render disk and produces:
 * - Rising (global breakout) ranking
 * - Simple explainability payload for tuning
 *
 * Notes:
 * - v1 uses events-agg.json (fast + deterministic)
 * - v2 can add personalization once user profiles exist
 */

import express from "express";
import fs from "fs/promises";
import path from "path";

const router = express.Router();

/** -----------------------------
 * Config
 * ------------------------------*/
const DATA_DIR = process.env.DATA_DIR || "/var/data/iband/db";
const EVENTS_AGG_FILE = process.env.EVENTS_AGG_FILE || path.join(DATA_DIR, "events-agg.json");

// Rising scoring window uses last100 debug trail as a “recent sample”
// (good enough for v1; later we’ll compute proper rolling windows from jsonl)
const RISING_RECENT_WINDOW_HOURS = parseInt(process.env.RISING_RECENT_WINDOW_HOURS || "6", 10);
const RISING_HALF_LIFE_HOURS = parseFloat(process.env.RISING_HALF_LIFE_HOURS || "24"); // freshness decay
const RISING_WATCHMS_PER_POINT = parseInt(process.env.RISING_WATCHMS_PER_POINT || "10000", 10); // 10s = 1 point

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

const routerVersion = 1;

/** -----------------------------
 * Helpers
 * ------------------------------*/
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

  // Exponential-ish decay using half-life
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
  const base = { version: 1, updatedAt: null, totals: {}, byArtist: {}, byType: {}, last100: [] };
  const agg = await readJsonSafe(EVENTS_AGG_FILE, base);

  if (!agg || typeof agg !== "object") return base;
  if (!agg.byArtist || typeof agg.byArtist !== "object") agg.byArtist = {};
  if (!Array.isArray(agg.last100)) agg.last100 = [];
  return agg;
}

function recentSampleForArtist(last100, artistId, windowHours) {
  const now = Date.now();
  const winMs = windowHours * 60 * 60 * 1000;

  const sample = {
    events: 0,
    view: 0,
    replay: 0,
    like: 0,
    save: 0,
    share: 0,
    follow: 0,
    comment: 0,
    vote: 0,
    watchMs: 0,
    lastAt: null,
  };

  for (let i = last100.length - 1; i >= 0; i--) {
    const e = last100[i];
    if (!e || e.artistId !== artistId) continue;

    const t = Date.parse(e.at);
    if (!Number.isFinite(t)) continue;
    if (now - t > winMs) break; // last100 is chronological-ish; break once outside window

    sample.events += 1;
    if (typeof e.type === "string" && sample[e.type] !== undefined) sample[e.type] += 1;
    sample.watchMs += safeNumber(e.watchMs, 0);
    sample.lastAt = e.at;
  }

  return sample;
}

function risingScore({ recent, lifetime, lastAt }) {
  // Recent weighted signal
  const watchPoints = recent.watchMs / Math.max(1000, RISING_WATCHMS_PER_POINT);

  const recentWeighted =
    recent.view * W_VIEW +
    recent.replay * W_REPLAY +
    recent.like * W_LIKE +
    recent.save * W_SAVE +
    recent.share * W_SHARE +
    recent.follow * W_FOLLOW +
    recent.comment * W_COMMENT +
    recent.vote * W_VOTE +
    watchPoints;

  // Lifetime provides stability but low influence (prevents “one spike” from dominating)
  const lifetimeWeighted =
    (safeNumber(lifetime.views) * 0.05) +
    (safeNumber(lifetime.replays) * 0.08) +
    (safeNumber(lifetime.likes) * 0.06) +
    (safeNumber(lifetime.saves) * 0.10) +
    (safeNumber(lifetime.shares) * 0.12) +
    (safeNumber(lifetime.follows) * 0.15) +
    (safeNumber(lifetime.comments) * 0.08) +
    (safeNumber(lifetime.votes) * 0.05) +
    (safeNumber(lifetime.watchMs) / Math.max(1, RISING_WATCHMS_PER_POINT) * 0.02);

  const freshness = decayMultiplier(lastAt);

  // Velocity boost: more recent events per hour => higher
  const vph = recent.events / Math.max(1, RISING_RECENT_WINDOW_HOURS);
  const velocityBoost = 1 + clamp(vph / 10, 0, 1.5); // gentle (0–2.5x)

  const score = (recentWeighted + lifetimeWeighted) * freshness * velocityBoost;

  return {
    score: Number(score.toFixed(6)),
    components: {
      recentWeighted: Number(recentWeighted.toFixed(6)),
      lifetimeWeighted: Number(lifetimeWeighted.toFixed(6)),
      freshness: Number(freshness.toFixed(6)),
      velocityBoost: Number(velocityBoost.toFixed(6)),
      vph: Number(vph.toFixed(6)),
      watchPoints: Number(watchPoints.toFixed(6)),
      windowHours: RISING_RECENT_WINDOW_HOURS,
      halfLifeHours: RISING_HALF_LIFE_HOURS,
    },
  };
}

/** -----------------------------
 * Middleware
 * ------------------------------*/
router.use(express.json({ limit: "64kb" }));

/** -----------------------------
 * GET endpoints
 * ------------------------------*/
router.get("/health", async (_req, res) => {
  return res.json({
    success: true,
    service: "ranking",
    version: routerVersion,
    dataDir: DATA_DIR,
    source: path.basename(EVENTS_AGG_FILE),
    updatedAt: nowIso(),
    config: {
      recentWindowHours: RISING_RECENT_WINDOW_HOURS,
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
    },
  });
});

/**
 * GET /api/ranking/rising?limit=25
 * Returns global "Rising" artists (breakout detection)
 */
router.get("/rising", async (req, res) => {
  const limit = clamp(parseInt(req.query.limit || `${MAX_RETURN}`, 10) || MAX_RETURN, 1, MAX_RETURN);

  const agg = await loadAgg();
  const last100 = Array.isArray(agg.last100) ? agg.last100 : [];

  const rows = [];
  for (const [artistId, bucket] of Object.entries(agg.byArtist || {})) {
    const lifetime = {
      views: safeNumber(bucket.views, 0),
      replays: safeNumber(bucket.replays, 0),
      likes: safeNumber(bucket.likes, 0),
      saves: safeNumber(bucket.saves, 0),
      shares: safeNumber(bucket.shares, 0),
      follows: safeNumber(bucket.follows, 0),
      comments: safeNumber(bucket.comments, 0),
      votes: safeNumber(bucket.votes, 0),
      watchMs: safeNumber(bucket.watchMs, 0),
    };

    const recent = recentSampleForArtist(last100, artistId, RISING_RECENT_WINDOW_HOURS);
    const lastAt = recent.lastAt || bucket.lastAt || null;

    const scored = risingScore({ recent, lifetime, lastAt });

    rows.push({
      artistId,
      risingScore: scored.score,
      lastAt,
      recent,
      lifetime,
      explain: scored.components,
    });
  }

  rows.sort((a, b) => b.risingScore - a.risingScore);

  return res.json({
    success: true,
    updatedAt: agg.updatedAt || null,
    windowHours: RISING_RECENT_WINDOW_HOURS,
    count: rows.length,
    results: rows.slice(0, limit),
  });
});

/**
 * GET /api/ranking/artist/:artistId
 * Returns the artist ranking breakdown (explainable)
 */
router.get("/artist/:artistId", async (req, res) => {
  const artistId = String(req.params.artistId || "").trim();
  if (!artistId) return res.status(400).json({ success: false, message: "artistId is required." });

  const agg = await loadAgg();
  const bucket = agg.byArtist?.[artistId];
  if (!bucket) return res.status(404).json({ success: false, message: "No ranking data for this artist." });

  const last100 = Array.isArray(agg.last100) ? agg.last100 : [];
  const lifetime = {
    views: safeNumber(bucket.views, 0),
    replays: safeNumber(bucket.replays, 0),
    likes: safeNumber(bucket.likes, 0),
    saves: safeNumber(bucket.saves, 0),
    shares: safeNumber(bucket.shares, 0),
    follows: safeNumber(bucket.follows, 0),
    comments: safeNumber(bucket.comments, 0),
    votes: safeNumber(bucket.votes, 0),
    watchMs: safeNumber(bucket.watchMs, 0),
  };

  const recent = recentSampleForArtist(last100, artistId, RISING_RECENT_WINDOW_HOURS);
  const lastAt = recent.lastAt || bucket.lastAt || null;
  const scored = risingScore({ recent, lifetime, lastAt });

  return res.json({
    success: true,
    updatedAt: agg.updatedAt || null,
    artistId,
    lastAt,
    risingScore: scored.score,
    recent,
    lifetime,
    explain: scored.components,
  });
});

export default router;