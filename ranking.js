/**
 * ranking.js (root) — ESM default export
 * iBand Algorithm Brain (v3.1)
 *
 * v3.1 Upgrade (Engagement Dominance Multipliers):
 * - Rising still uses true rolling-window momentum from events.jsonl (velocity)
 * - Adds engagement dominance boost when likes/saves/shares happen in-window
 * - Boost is capped + tunable via env vars
 * - Bucket metrics remain safe fallback (never breaks)
 *
 * Endpoints:
 * - GET /api/ranking/health
 * - GET /api/ranking/rising?windowHours=6&limit=50
 * - GET /api/ranking/trending?limit=50
 * - GET /api/ranking/artist/:artistId?windowHours=6
 */

import express from "express";
import fs from "fs/promises";
import path from "path";

const router = express.Router();

// -------------------- Paths / Env --------------------
const DATA_DIR = process.env.DATA_DIR || "/var/data/iband/db";
const EVENTS_AGG_FILE = process.env.EVENTS_AGG_FILE || path.join(DATA_DIR, "events-agg.json");
const EVENTS_LOG_FILE = process.env.EVENTS_LOG_FILE || path.join(DATA_DIR, "events.jsonl");

// Rolling window controls
const DEFAULT_WINDOW_HOURS = parseFloat(process.env.RANKING_WINDOW_HOURS || "6");
const MAX_WINDOW_HOURS = parseFloat(process.env.RANKING_MAX_WINDOW_HOURS || "72");

// Tail-reading controls (Render-safe)
const TAIL_KB = parseInt(process.env.RANKING_TAIL_KB || "512", 10);
const MAX_LINES = parseInt(process.env.RANKING_MAX_LINES || "3000", 10);

// Freshness / watch
const RISING_HALF_LIFE_HOURS = parseFloat(process.env.RISING_HALF_LIFE_HOURS || "24");
const RISING_WATCHMS_PER_POINT = parseInt(process.env.RISING_WATCHMS_PER_POINT || "10000", 10);

// Weights (shared)
const W_VIEW = parseFloat(process.env.RISING_W_VIEW || "1.0");
const W_REPLAY = parseFloat(process.env.RISING_W_REPLAY || "2.5");
const W_LIKE = parseFloat(process.env.RISING_W_LIKE || "1.5");
const W_SAVE = parseFloat(process.env.RISING_W_SAVE || "3.5");
const W_SHARE = parseFloat(process.env.RISING_W_SHARE || "4.5");
const W_FOLLOW = parseFloat(process.env.RISING_W_FOLLOW || "5.0");
const W_COMMENT = parseFloat(process.env.RISING_W_COMMENT || "2.0");
const W_VOTE = parseFloat(process.env.RISING_W_VOTE || "1.0");

const MAX_RETURN = parseInt(process.env.RANKING_MAX_RETURN || "50", 10);
const routerVersion = 31; // v3.1

// Rising composition controls
const VELOCITY_BOOST_MAX = parseFloat(process.env.RANKING_VELOCITY_BOOST_MAX || "1.35");
const VELOCITY_BOOST_MIN = parseFloat(process.env.RANKING_VELOCITY_BOOST_MIN || "1.0");
const EPH_PER_10PCT = parseFloat(process.env.RANKING_EPH_PER_10PCT || "1"); // eph per +10%

// v3.1: Engagement dominance multipliers (window-only)
const ENG_DOMINANCE_STRENGTH = parseFloat(process.env.RANKING_ENG_DOMINANCE_STRENGTH || "0.35");
const ENG_DOMINANCE_MAX = parseFloat(process.env.RANKING_ENG_DOMINANCE_MAX || "1.25");
const ENG_SHARE_BONUS = parseFloat(process.env.RANKING_ENG_SHARE_BONUS || "0.10"); // +10% if share>=1
const ENG_SAVE_BONUS = parseFloat(process.env.RANKING_ENG_SAVE_BONUS || "0.07");   // +7% if save>=1
const ENG_LIKE_BONUS = parseFloat(process.env.RANKING_ENG_LIKE_BONUS || "0.04");   // +4% if like>=1
const ENG_BONUS_MAX = parseFloat(process.env.RANKING_ENG_BONUS_MAX || "1.20");     // cap on bonus stack

// Trending freshness is intentionally mild
const TRENDING_FRESHNESS_MIN = parseFloat(process.env.RANKING_TRENDING_FRESHNESS_MIN || "0.65");

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

function hoursBetween(isoA, isoB) {
  const a = Date.parse(isoA);
  const b = Date.parse(isoB);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.abs(b - a) / (1000 * 60 * 60);
}

function decayMultiplier(lastAtIso, halfLifeHours) {
  if (!lastAtIso) return 1;
  const ageH = hoursBetween(lastAtIso, nowIso());
  if (ageH === null) return 1;

  const hl = Math.max(1, safeNumber(halfLifeHours, 24));
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

async function statOk(p) {
  try {
    const s = await fs.stat(p);
    return { ok: true, size: s.size, mtimeMs: s.mtimeMs };
  } catch (e) {
    return { ok: false, error: e?.code || String(e) };
  }
}

// Read last N KB from file, split into lines, parse JSON safely.
// Works well on Render disk, avoids loading entire file.
async function readJsonlTail(filePath, tailKb, maxLines) {
  try {
    const s = await fs.stat(filePath);
    const size = s.size;
    const bytes = Math.min(size, Math.max(8 * 1024, tailKb * 1024));
    const fh = await fs.open(filePath, "r");
    try {
      const buf = Buffer.alloc(bytes);
      await fh.read(buf, 0, bytes, size - bytes);
      const text = buf.toString("utf8");

      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const tail = lines.slice(-maxLines);

      const events = [];
      for (const line of tail) {
        try {
          const obj = JSON.parse(line);
          if (obj && typeof obj === "object") events.push(obj);
        } catch {
          // ignore bad lines
        }
      }
      return { ok: true, events, lines: tail.length, error: null };
    } finally {
      await fh.close();
    }
  } catch (e) {
    return { ok: false, events: [], lines: 0, error: e?.code || String(e) };
  }
}

function normalizeType(t) {
  const x = String(t || "").toLowerCase().trim();
  if (!x) return null;
  return x;
}

function withinWindow(atIso, windowHours) {
  const t = Date.parse(atIso);
  if (!Number.isFinite(t)) return false;
  const now = Date.now();
  const maxAgeMs = windowHours * 60 * 60 * 1000;
  return now - t <= maxAgeMs;
}

function scoreWeighted({ view, replay, like, save, share, follow, comment, vote, watchMs }) {
  const watchPoints = safeNumber(watchMs, 0) / Math.max(1000, RISING_WATCHMS_PER_POINT);

  const weighted =
    safeNumber(view, 0) * W_VIEW +
    safeNumber(replay, 0) * W_REPLAY +
    safeNumber(like, 0) * W_LIKE +
    safeNumber(save, 0) * W_SAVE +
    safeNumber(share, 0) * W_SHARE +
    safeNumber(follow, 0) * W_FOLLOW +
    safeNumber(comment, 0) * W_COMMENT +
    safeNumber(vote, 0) * W_VOTE +
    watchPoints;

  return { weighted, watchPoints };
}

function scoreEngagementOnly({ like, save, share, follow, comment, vote }) {
  return (
    safeNumber(like, 0) * W_LIKE +
    safeNumber(save, 0) * W_SAVE +
    safeNumber(share, 0) * W_SHARE +
    safeNumber(follow, 0) * W_FOLLOW +
    safeNumber(comment, 0) * W_COMMENT +
    safeNumber(vote, 0) * W_VOTE
  );
}

// Build rolling window metrics from jsonl tail (best-effort)
function buildWindowMetrics(events, windowHours) {
  const byArtist = {};

  for (const ev of events) {
    const at = ev?.at;
    if (!at || !withinWindow(at, windowHours)) continue;

    const type = normalizeType(ev?.type);
    const artistId = String(ev?.artistId || "").trim();
    if (!type || !artistId) continue;

    if (!byArtist[artistId]) {
      byArtist[artistId] = {
        artistId,
        lastAt: at,
        view: 0,
        replay: 0,
        like: 0,
        save: 0,
        share: 0,
        follow: 0,
        comment: 0,
        vote: 0,
        watchMs: 0,
        events: 0,
      };
    }

    const row = byArtist[artistId];
    row.events += 1;

    if (!row.lastAt || Date.parse(at) > Date.parse(row.lastAt)) row.lastAt = at;

    const wm = safeNumber(ev?.watchMs, 0);
    if (wm > 0) row.watchMs += wm;

    if (type === "view") row.view += 1;
    else if (type === "replay") row.replay += 1;
    else if (type === "like") row.like += 1;
    else if (type === "save") row.save += 1;
    else if (type === "share") row.share += 1;
    else if (type === "follow") row.follow += 1;
    else if (type === "comment") row.comment += 1;
    else if (type === "vote") row.vote += 1;
  }

  return byArtist;
}

function computeVelocityBoost(windowRow, windowHours) {
  if (!windowRow) return { velocityBoost: 1.0, eph: 0 };

  const h = Math.max(1, safeNumber(windowHours, DEFAULT_WINDOW_HOURS));
  const eph = safeNumber(windowRow.events, 0) / h;

  // Every +EPH_PER_10PCT eph => +10% boost, capped
  const steps = eph / Math.max(0.0001, EPH_PER_10PCT);
  const raw = 1.0 + (steps * 0.10);

  const velocityBoost = clamp(raw, VELOCITY_BOOST_MIN, VELOCITY_BOOST_MAX);
  return { velocityBoost, eph };
}

function computeEngagementDominanceBoost(windowRow, windowWeighted) {
  if (!windowRow) {
    return {
      dominanceMultiplier: 1.0,
      bonusMultiplier: 1.0,
      engagementWeighted: 0,
      dominanceRatio: 0,
    };
  }

  const engagementWeighted = scoreEngagementOnly({
    like: windowRow.like,
    save: windowRow.save,
    share: windowRow.share,
    follow: windowRow.follow,
    comment: windowRow.comment,
    vote: windowRow.vote,
  });

  const denom = Math.max(1e-6, safeNumber(windowWeighted, 0));
  const dominanceRatio = engagementWeighted / denom;

  // dominanceMultiplier = 1 + ratio * strength (capped)
  const dominanceMultiplier = clamp(
    1.0 + (dominanceRatio * Math.max(0, ENG_DOMINANCE_STRENGTH)),
    1.0,
    Math.max(1.0, ENG_DOMINANCE_MAX)
  );

  // bonusMultiplier = stacked discrete bonuses (capped)
  let bonus = 1.0;
  if (safeNumber(windowRow.share, 0) >= 1) bonus *= (1.0 + Math.max(0, ENG_SHARE_BONUS));
  if (safeNumber(windowRow.save, 0) >= 1) bonus *= (1.0 + Math.max(0, ENG_SAVE_BONUS));
  if (safeNumber(windowRow.like, 0) >= 1) bonus *= (1.0 + Math.max(0, ENG_LIKE_BONUS));
  const bonusMultiplier = clamp(bonus, 1.0, Math.max(1.0, ENG_BONUS_MAX));

  return {
    dominanceMultiplier,
    bonusMultiplier,
    engagementWeighted: Number(engagementWeighted.toFixed(6)),
    dominanceRatio: Number(dominanceRatio.toFixed(6)),
  };
}

// Rising score (v3.1):
// (windowWeighted) * freshness * velocityBoost * engagementDominance * engagementBonus
function risingScoreFromWindowAndBucket(windowRow, bucket, windowHours) {
  const w = windowRow || null;
  const b = bucket || null;

  const bucketMetrics = b
    ? {
        lastAt: b.lastAt || null,
      }
    : { lastAt: null };

  const { weighted: windowWeighted, watchPoints } = scoreWeighted({
    view: w?.view || 0,
    replay: w?.replay || 0,
    like: w?.like || 0,
    save: w?.save || 0,
    share: w?.share || 0,
    follow: w?.follow || 0,
    comment: w?.comment || 0,
    vote: w?.vote || 0,
    watchMs: w?.watchMs || 0,
  });

  const lastAt = (w?.lastAt || bucketMetrics.lastAt || null);

  const freshness = decayMultiplier(lastAt, RISING_HALF_LIFE_HOURS);

  const { velocityBoost, eph } = computeVelocityBoost(w, windowHours);

  const {
    dominanceMultiplier,
    bonusMultiplier,
    engagementWeighted,
    dominanceRatio,
  } = computeEngagementDominanceBoost(w, windowWeighted);

  const usedWindow = Boolean(w);

  const scoreRaw = windowWeighted * freshness * velocityBoost * dominanceMultiplier * bonusMultiplier;
  const score = usedWindow ? scoreRaw : 0; // rising is window-driven by design

  return {
    score: Number(score.toFixed(6)),
    explain: {
      windowWeighted: Number(windowWeighted.toFixed(6)),
      freshness: Number(freshness.toFixed(6)),
      velocityBoost: Number(velocityBoost.toFixed(6)),
      eph: Number(eph.toFixed(6)),
      watchPoints: Number(watchPoints.toFixed(6)),
      usedWindow,
      // v3.1 engagement extras
      engagementWeighted,
      dominanceRatio,
      dominanceMultiplier: Number(dominanceMultiplier.toFixed(6)),
      bonusMultiplier: Number(bonusMultiplier.toFixed(6)),
      windowHours: Number(windowHours),
      halfLifeHours: RISING_HALF_LIFE_HOURS,
    },
  };
}

// Trending score:
// bucketWeighted * max(rawFreshness, floor)
function trendingScoreFromBucket(bucket) {
  const views = safeNumber(bucket.views, 0);
  const replays = safeNumber(bucket.replays, 0);
  const likes = safeNumber(bucket.likes, 0);
  const saves = safeNumber(bucket.saves, 0);
  const shares = safeNumber(bucket.shares, 0);
  const follows = safeNumber(bucket.follows, 0);
  const comments = safeNumber(bucket.comments, 0);
  const votes = safeNumber(bucket.votes, 0);
  const watchMs = safeNumber(bucket.watchMs, 0);

  const { weighted, watchPoints } = scoreWeighted({
    view: views,
    replay: replays,
    like: likes,
    save: saves,
    share: shares,
    follow: follows,
    comment: comments,
    vote: votes,
    watchMs,
  });

  const rawFreshness = decayMultiplier(bucket.lastAt || null, RISING_HALF_LIFE_HOURS);
  const appliedFreshness = Math.max(rawFreshness, TRENDING_FRESHNESS_MIN);

  const score = weighted * appliedFreshness;

  return {
    score: Number(score.toFixed(6)),
    explain: {
      weighted: Number(weighted.toFixed(6)),
      rawFreshness: Number(rawFreshness.toFixed(6)),
      appliedFreshness: Number(appliedFreshness.toFixed(6)),
      watchPoints: Number(watchPoints.toFixed(6)),
      halfLifeHours: RISING_HALF_LIFE_HOURS,
      floor: TRENDING_FRESHNESS_MIN,
    },
  };
}

router.use(express.json({ limit: "64kb" }));

// -------------------- Health --------------------
router.get("/health", async (_req, res) => {
  const aggStat = await statOk(EVENTS_AGG_FILE);
  const logStat = await statOk(EVENTS_LOG_FILE);

  return res.json({
    success: true,
    service: "ranking",
    version: 3,
    patch: "3.1-engagement-multipliers",
    dataDir: DATA_DIR,
    files: {
      eventsAgg: { path: EVENTS_AGG_FILE, stat: aggStat },
      eventsLog: { path: EVENTS_LOG_FILE, stat: logStat },
    },
    updatedAt: nowIso(),
    config: {
      windowHoursDefault: DEFAULT_WINDOW_HOURS,
      windowHoursMax: MAX_WINDOW_HOURS,
      tailKb: TAIL_KB,
      maxLines: MAX_LINES,
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
      rising: {
        velocityBoostMin: VELOCITY_BOOST_MIN,
        velocityBoostMax: VELOCITY_BOOST_MAX,
        ephPer10pct: EPH_PER_10PCT,
        engagement: {
          dominanceStrength: ENG_DOMINANCE_STRENGTH,
          dominanceMax: ENG_DOMINANCE_MAX,
          shareBonus: ENG_SHARE_BONUS,
          saveBonus: ENG_SAVE_BONUS,
          likeBonus: ENG_LIKE_BONUS,
          bonusMax: ENG_BONUS_MAX,
        },
      },
      trending: {
        freshnessFloor: TRENDING_FRESHNESS_MIN,
      },
      maxReturn: MAX_RETURN,
    },
  });
});

// -------------------- Rising --------------------
router.get("/rising", async (req, res) => {
  const windowHours = clamp(
    parseFloat(req.query.windowHours || `${DEFAULT_WINDOW_HOURS}`) || DEFAULT_WINDOW_HOURS,
    1,
    MAX_WINDOW_HOURS
  );

  const limit = clamp(
    parseInt(req.query.limit || `${MAX_RETURN}`, 10) || MAX_RETURN,
    1,
    MAX_RETURN
  );

  const agg = await loadAgg();
  const tail = await readJsonlTail(EVENTS_LOG_FILE, TAIL_KB, MAX_LINES);

  const byArtistWindow = tail.ok ? buildWindowMetrics(tail.events, windowHours) : {};

  const rows = [];
  for (const [artistId, bucket] of Object.entries(agg.byArtist || {})) {
    const w = byArtistWindow[artistId] || null;
    const scored = risingScoreFromWindowAndBucket(w, bucket, windowHours);

    rows.push({
      artistId,
      risingScore: scored.score,
      lastAt: (w?.lastAt || bucket?.lastAt || null),
      window: w
        ? {
            events: w.events,
            view: w.view,
            replay: w.replay,
            like: w.like,
            save: w.save,
            share: w.share,
            follow: w.follow,
            comment: w.comment,
            vote: w.vote,
            watchMs: w.watchMs,
            lastAt: w.lastAt,
          }
        : null,
      lifetime: {
        views: safeNumber(bucket?.views, 0),
        replays: safeNumber(bucket?.replays, 0),
        likes: safeNumber(bucket?.likes, 0),
        saves: safeNumber(bucket?.saves, 0),
        shares: safeNumber(bucket?.shares, 0),
        follows: safeNumber(bucket?.follows, 0),
        comments: safeNumber(bucket?.comments, 0),
        votes: safeNumber(bucket?.votes, 0),
        watchMs: safeNumber(bucket?.watchMs, 0),
      },
      explain: scored.explain,
    });
  }

  rows.sort((a, b) => b.risingScore - a.risingScore);

  return res.json({
    success: true,
    updatedAt: agg.updatedAt || null,
    windowHours,
    tail: {
      file: path.basename(EVENTS_LOG_FILE),
      ok: tail.ok,
      linesParsed: tail.lines,
      error: tail.error || null,
    },
    count: rows.length,
    results: rows.slice(0, limit),
  });
});

// -------------------- Trending --------------------
router.get("/trending", async (req, res) => {
  const limit = clamp(
    parseInt(req.query.limit || `${MAX_RETURN}`, 10) || MAX_RETURN,
    1,
    MAX_RETURN
  );

  const agg = await loadAgg();

  const rows = [];
  for (const [artistId, bucket] of Object.entries(agg.byArtist || {})) {
    const scored = trendingScoreFromBucket(bucket);
    rows.push({
      artistId,
      trendingScore: scored.score,
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
      explain: scored.explain,
    });
  }

  rows.sort((a, b) => b.trendingScore - a.trendingScore);

  return res.json({
    success: true,
    updatedAt: agg.updatedAt || null,
    count: rows.length,
    results: rows.slice(0, limit),
  });
});

// -------------------- Single Artist --------------------
router.get("/artist/:artistId", async (req, res) => {
  const artistId = String(req.params.artistId || "").trim();
  if (!artistId) return res.status(400).json({ success: false, message: "artistId is required." });

  const windowHours = clamp(
    parseFloat(req.query.windowHours || `${DEFAULT_WINDOW_HOURS}`) || DEFAULT_WINDOW_HOURS,
    1,
    MAX_WINDOW_HOURS
  );

  const agg = await loadAgg();
  const bucket = agg.byArtist?.[artistId];
  if (!bucket) return res.status(404).json({ success: false, message: "No ranking data for this artist." });

  const tail = await readJsonlTail(EVENTS_LOG_FILE, TAIL_KB, MAX_LINES);
  const byArtistWindow = tail.ok ? buildWindowMetrics(tail.events, windowHours) : {};
  const w = byArtistWindow[artistId] || null;

  const rising = risingScoreFromWindowAndBucket(w, bucket, windowHours);
  const trending = trendingScoreFromBucket(bucket);

  return res.json({
    success: true,
    updatedAt: agg.updatedAt || null,
    artistId,
    windowHours,
    lastAt: (w?.lastAt || bucket?.lastAt || null),
    risingScore: rising.score,
    trendingScore: trending.score,
    window: w
      ? {
          events: w.events,
          view: w.view,
          replay: w.replay,
          like: w.like,
          save: w.save,
          share: w.share,
          follow: w.follow,
          comment: w.comment,
          vote: w.vote,
          watchMs: w.watchMs,
          lastAt: w.lastAt,
        }
      : null,
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
    explain: {
      rising: rising.explain,
      trending: trending.explain,
    },
    tail: {
      file: path.basename(EVENTS_LOG_FILE),
      ok: tail.ok,
      linesParsed: tail.lines,
      error: tail.error || null,
    },
  });
});

export default router;