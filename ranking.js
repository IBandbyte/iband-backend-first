/**
 * ranking.js (root) — ESM default export
 * iBand Algorithm Brain (v3)
 *
 * v3 Upgrade:
 * - Adds true rolling-window momentum from events.jsonl (velocity)
 * - Keeps bucket metrics as safe fallback (never breaks)
 * - Rising = window-weighted momentum * freshness * velocityBoost
 * - Trending = bucket-weighted popularity * mild freshness
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
const EVENTS_AGG_FILE =
  process.env.EVENTS_AGG_FILE || path.join(DATA_DIR, "events-agg.json");
const EVENTS_LOG_FILE =
  process.env.EVENTS_LOG_FILE || path.join(DATA_DIR, "events.jsonl");

// Rolling window controls
const DEFAULT_WINDOW_HOURS = parseFloat(process.env.RANKING_WINDOW_HOURS || "6");
const MAX_WINDOW_HOURS = parseFloat(process.env.RANKING_MAX_WINDOW_HOURS || "72");

// Tail-reading controls (Render-safe)
const TAIL_KB = parseInt(process.env.RANKING_TAIL_KB || "512", 10);
const MAX_LINES = parseInt(process.env.RANKING_MAX_LINES || "3000", 10);

// Freshness / watch
const RISING_HALF_LIFE_HOURS = parseFloat(
  process.env.RISING_HALF_LIFE_HOURS || "24"
);
const RISING_WATCHMS_PER_POINT = parseInt(
  process.env.RISING_WATCHMS_PER_POINT || "10000",
  10
);

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
const routerVersion = 3;

// Rising composition controls
const VELOCITY_BOOST_MAX = parseFloat(
  process.env.RANKING_VELOCITY_BOOST_MAX || "1.35"
);
const VELOCITY_BOOST_MIN = parseFloat(
  process.env.RANKING_VELOCITY_BOOST_MIN || "1.0"
);

// How quickly eph converts to boost
const VELOCITY_EPH_PER_10PCT = parseFloat(
  process.env.RANKING_VELOCITY_EPH_PER_10PCT || "1.0"
);

// Trending freshness is intentionally mild
const TRENDING_FRESHNESS_MIN = parseFloat(
  process.env.RANKING_TRENDING_FRESHNESS_MIN || "0.65"
);

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
      return { ok: true, events, lines: tail.length };
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

function scoreWeighted({
  view,
  replay,
  like,
  save,
  share,
  follow,
  comment,
  vote,
  watchMs,
}) {
  const watchPoints =
    safeNumber(watchMs, 0) / Math.max(1000, RISING_WATCHMS_PER_POINT);

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

function velocityBoostFromEph(eph) {
  // 10% boost per VELOCITY_EPH_PER_10PCT events/hour
  const per = Math.max(0.25, safeNumber(VELOCITY_EPH_PER_10PCT, 1.0));
  const steps = safeNumber(eph, 0) / per; // e.g. eph=1, per=1 => 1 step => +0.10
  const boost = 1 + steps * 0.1;
  return clamp(boost, VELOCITY_BOOST_MIN, VELOCITY_BOOST_MAX);
}

// Rising score (v3):
// windowWeighted * freshness * velocityBoost
function risingScoreFromWindowAndBucket(windowRow, bucket, windowHours) {
  const w = windowRow || null;
  const b = bucket || null;

  const windowMetrics = w
    ? {
        view: w.view,
        replay: w.replay,
        like: w.like,
        save: w.save,
        share: w.share,
        follow: w.follow,
        comment: w.comment,
        vote: w.vote,
        watchMs: w.watchMs,
      }
    : {
        view: 0,
        replay: 0,
        like: 0,
        save: 0,
        share: 0,
        follow: 0,
        comment: 0,
        vote: 0,
        watchMs: 0,
      };

  const bucketLastAt = b?.lastAt || null;
  const lastAt = w?.lastAt || bucketLastAt || null;

  const { weighted: windowWeighted, watchPoints } = scoreWeighted({
    view: windowMetrics.view,
    replay: windowMetrics.replay,
    like: windowMetrics.like,
    save: windowMetrics.save,
    share: windowMetrics.share,
    follow: windowMetrics.follow,
    comment: windowMetrics.comment,
    vote: windowMetrics.vote,
    watchMs: windowMetrics.watchMs,
  });

  const freshness = decayMultiplier(lastAt, RISING_HALF_LIFE_HOURS);

  const wh = Math.max(1, safeNumber(windowHours, DEFAULT_WINDOW_HOURS));
  const eph = w ? safeNumber(w.events, 0) / wh : 0;
  const velocityBoost = velocityBoostFromEph(eph);

  const score = windowWeighted * freshness * velocityBoost;

  return {
    score: Number(score.toFixed(6)),
    explain: {
      windowWeighted: Number(windowWeighted.toFixed(6)),
      freshness: Number(freshness.toFixed(6)),
      velocityBoost: Number(velocityBoost.toFixed(6)),
      eph: Number(eph.toFixed(6)),
      watchPoints: Number(watchPoints.toFixed(6)),
      windowHours: wh,
      halfLifeHours: RISING_HALF_LIFE_HOURS,
      usedWindow: Boolean(w),
    },
  };
}

// Trending score (v3):
// bucketWeighted * max(mildFreshness, TRENDING_FRESHNESS_MIN)
function trendingScoreFromBucket(bucket) {
  const b = bucket || {};

  const { weighted, watchPoints } = scoreWeighted({
    view: safeNumber(b.views, 0),
    replay: safeNumber(b.replays, 0),
    like: safeNumber(b.likes, 0),
    save: safeNumber(b.saves, 0),
    share: safeNumber(b.shares, 0),
    follow: safeNumber(b.follows, 0),
    comment: safeNumber(b.comments, 0),
    vote: safeNumber(b.votes, 0),
    watchMs: safeNumber(b.watchMs, 0),
  });

  const rawFresh = decayMultiplier(b.lastAt || null, RISING_HALF_LIFE_HOURS);
  const freshness = Math.max(TRENDING_FRESHNESS_MIN, rawFresh);

  const score = weighted * freshness;

  return {
    score: Number(score.toFixed(6)),
    explain: {
      weighted: Number(weighted.toFixed(6)),
      rawFreshness: Number(rawFresh.toFixed(6)),
      appliedFreshness: Number(freshness.toFixed(6)),
      watchPoints: Number(watchPoints.toFixed(6)),
      halfLifeHours: RISING_HALF_LIFE_HOURS,
      floor: TRENDING_FRESHNESS_MIN,
    },
  };
}

router.use(express.json({ limit: "64kb" }));

// -------------------- HEALTH --------------------
router.get("/health", async (_req, res) => {
  const aggStat = await statOk(EVENTS_AGG_FILE);
  const logStat = await statOk(EVENTS_LOG_FILE);

  return res.json({
    success: true,
    service: "ranking",
    version: routerVersion,
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
        ephPer10pct: VELOCITY_EPH_PER_10PCT,
      },
      trending: {
        freshnessFloor: TRENDING_FRESHNESS_MIN,
      },
      maxReturn: MAX_RETURN,
    },
  });
});

// -------------------- RISING --------------------
router.get("/rising", async (req, res) => {
  const limit = clamp(
    parseInt(req.query.limit || `${MAX_RETURN}`, 10) || MAX_RETURN,
    1,
    MAX_RETURN
  );

  const windowHours = clamp(
    safeNumber(req.query.windowHours, DEFAULT_WINDOW_HOURS),
    1,
    MAX_WINDOW_HOURS
  );

  const agg = await loadAgg();

  const tail = await readJsonlTail(EVENTS_LOG_FILE, TAIL_KB, MAX_LINES);
  const windowByArtist = tail.ok ? buildWindowMetrics(tail.events, windowHours) : {};

  // union of artists: agg.byArtist keys + windowByArtist keys
  const artistIds = new Set([
    ...Object.keys(agg.byArtist || {}),
    ...Object.keys(windowByArtist || {}),
  ]);

  const rows = [];
  for (const artistId of artistIds) {
    const bucket = agg.byArtist?.[artistId] || null;
    const win = windowByArtist?.[artistId] || null;

    const scored = risingScoreFromWindowAndBucket(win, bucket, windowHours);

    rows.push({
      artistId,
      risingScore: scored.score,
      lastAt: (win?.lastAt || bucket?.lastAt || null),
      window: win
        ? {
            events: safeNumber(win.events, 0),
            view: safeNumber(win.view, 0),
            replay: safeNumber(win.replay, 0),
            like: safeNumber(win.like, 0),
            save: safeNumber(win.save, 0),
            share: safeNumber(win.share, 0),
            follow: safeNumber(win.follow, 0),
            comment: safeNumber(win.comment, 0),
            vote: safeNumber(win.vote, 0),
            watchMs: safeNumber(win.watchMs, 0),
            lastAt: win.lastAt || null,
          }
        : null,
      lifetime: bucket
        ? {
            views: safeNumber(bucket.views, 0),
            replays: safeNumber(bucket.replays, 0),
            likes: safeNumber(bucket.likes, 0),
            saves: safeNumber(bucket.saves, 0),
            shares: safeNumber(bucket.shares, 0),
            follows: safeNumber(bucket.follows, 0),
            comments: safeNumber(bucket.comments, 0),
            votes: safeNumber(bucket.votes, 0),
            watchMs: safeNumber(bucket.watchMs, 0),
          }
        : {
            views: 0,
            replays: 0,
            likes: 0,
            saves: 0,
            shares: 0,
            follows: 0,
            comments: 0,
            votes: 0,
            watchMs: 0,
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
      error: tail.ok ? null : tail.error || "tail_read_failed",
    },
    count: rows.length,
    results: rows.slice(0, limit),
  });
});

// -------------------- TRENDING --------------------
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
      lastAt: bucket?.lastAt || null,
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

// -------------------- SINGLE ARTIST --------------------
router.get("/artist/:artistId", async (req, res) => {
  const artistId = String(req.params.artistId || "").trim();
  if (!artistId) {
    return res.status(400).json({ success: false, message: "artistId is required." });
  }

  const windowHours = clamp(
    safeNumber(req.query.windowHours, DEFAULT_WINDOW_HOURS),
    1,
    MAX_WINDOW_HOURS
  );

  const agg = await loadAgg();
  const bucket = agg.byArtist?.[artistId] || null;

  const tail = await readJsonlTail(EVENTS_LOG_FILE, TAIL_KB, MAX_LINES);
  const windowByArtist = tail.ok ? buildWindowMetrics(tail.events, windowHours) : {};
  const win = windowByArtist?.[artistId] || null;

  if (!bucket && !win) {
    return res.status(404).json({
      success: false,
      message: "No ranking data for this artist (bucket and window both empty).",
      artistId,
    });
  }

  const rising = risingScoreFromWindowAndBucket(win, bucket, windowHours);
  const trending = bucket ? trendingScoreFromBucket(bucket) : { score: 0, explain: { note: "no_bucket" } };

  return res.json({
    success: true,
    updatedAt: agg.updatedAt || null,
    artistId,
    windowHours,
    lastAt: (win?.lastAt || bucket?.lastAt || null),
    risingScore: rising.score,
    trendingScore: trending.score,
    window: win
      ? {
          events: safeNumber(win.events, 0),
          view: safeNumber(win.view, 0),
          replay: safeNumber(win.replay, 0),
          like: safeNumber(win.like, 0),
          save: safeNumber(win.save, 0),
          share: safeNumber(win.share, 0),
          follow: safeNumber(win.follow, 0),
          comment: safeNumber(win.comment, 0),
          vote: safeNumber(win.vote, 0),
          watchMs: safeNumber(win.watchMs, 0),
          lastAt: win.lastAt || null,
        }
      : null,
    lifetime: bucket
      ? {
          views: safeNumber(bucket.views, 0),
          replays: safeNumber(bucket.replays, 0),
          likes: safeNumber(bucket.likes, 0),
          saves: safeNumber(bucket.saves, 0),
          shares: safeNumber(bucket.shares, 0),
          follows: safeNumber(bucket.follows, 0),
          comments: safeNumber(bucket.comments, 0),
          votes: safeNumber(bucket.votes, 0),
          watchMs: safeNumber(bucket.watchMs, 0),
          lastAt: bucket.lastAt || null,
        }
      : {
          views: 0,
          replays: 0,
          likes: 0,
          saves: 0,
          shares: 0,
          follows: 0,
          comments: 0,
          votes: 0,
          watchMs: 0,
          lastAt: null,
        },
    explain: {
      rising: rising.explain,
      trending: trending.explain,
      tail: {
        ok: tail.ok,
        linesParsed: tail.lines,
        error: tail.ok ? null : tail.error || "tail_read_failed",
      },
    },
  });
});

export default router;