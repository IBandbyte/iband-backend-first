/**
 * recs.js (root) — ESM default export
 * iBand Feed Generator (v1)
 *
 * Purpose:
 * - Provide stable feed endpoints the frontend can call
 * - Use ranking.js (bucket-primary) as the source of truth
 * - Keep logic simple, deterministic, and testable
 *
 * Endpoints:
 * - GET /api/recs/health
 * - GET /api/recs/rising?limit=20
 */

import express from "express";
import fs from "fs/promises";
import path from "path";

const router = express.Router();

/** -----------------------------
 * Config
 * ------------------------------*/
const DATA_DIR = process.env.DATA_DIR || "/var/data/iband/db";
const EVENTS_AGG_FILE =
  process.env.EVENTS_AGG_FILE || path.join(DATA_DIR, "events-agg.json");

const MAX_RETURN = parseInt(process.env.RECS_MAX_RETURN || "50", 10);
const routerVersion = 1;

/** -----------------------------
 * Helpers
 * ------------------------------*/
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

/**
 * Same rising logic as ranking v2 (bucket-primary)
 * We duplicate lightly here on purpose:
 * - avoids cross-router coupling
 * - keeps recs.js independently testable
 */
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

  const score = weighted * freshness;

  return Number(score.toFixed(6));
}

/** -----------------------------
 * Middleware
 * ------------------------------*/
router.use(express.json({ limit: "64kb" }));

/** -----------------------------
 * Endpoints
 * ------------------------------*/
router.get("/health", (_req, res) => {
  res.json({
    success: true,
    service: "recs",
    version: routerVersion,
    source: path.basename(EVENTS_AGG_FILE),
    updatedAt: nowIso(),
    maxReturn: MAX_RETURN,
  });
});

/**
 * GET /api/recs/rising?limit=20
 * Returns a feed ordered by rising score
 */
router.get("/rising", async (req, res) => {
  const limit = clamp(
    parseInt(req.query.limit || `${MAX_RETURN}`, 10) || MAX_RETURN,
    1,
    MAX_RETURN
  );

  const agg = await loadAgg();

  const rows = [];
  for (const [artistId, bucket] of Object.entries(agg.byArtist || {})) {
    const score = risingScoreFromBucket(bucket);

    rows.push({
      artistId,
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
    count: rows.length,
    results: rows.slice(0, limit),
  });
});

export default router;