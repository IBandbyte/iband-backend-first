/**
 * recs.js (root) — ESM default export
 * iBand Feed Generator (v5 — personalized)
 *
 * Keeps:
 * - /api/recs/health
 * - /api/recs/rising
 *
 * Adds:
 * - /api/recs/personalized/health
 * - /api/recs/personalized?sessionId=...&limit=...
 *
 * Personalization v1:
 * - Read last chunk of events.jsonl
 * - Build session-level engagement per artist
 * - Apply small explainable boosts for engaged artists
 * - Apply light fatigue penalty for repeatedly seen artists
 *
 * Safety:
 * - No auth required
 * - No code self-mutation
 * - Deterministic + explainable output
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

const EVENTS_LOG_FILE =
  process.env.EVENTS_LOG_FILE || path.join(DATA_DIR, "events.jsonl");

const ARTISTS_FILE =
  process.env.ARTISTS_FILE || path.join(DATA_DIR, "artists.json");

const MAX_RETURN = parseInt(process.env.RECS_MAX_RETURN || "50", 10);

// Personalization scan limits (Render-safe)
const PERSONALIZE_TAIL_KB = parseInt(process.env.PERSONALIZE_TAIL_KB || "512", 10); // read last 512KB
const PERSONALIZE_MAX_LINES = parseInt(process.env.PERSONALIZE_MAX_LINES || "2500", 10); // cap lines parsed

const routerVersion = 5;

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

async function statSafe(p) {
  try {
    const st = await fs.stat(p);
    return { ok: true, size: st.size, mtimeMs: st.mtimeMs };
  } catch (e) {
    return { ok: false, error: e?.code || e?.message || "stat_failed" };
  }
}

async function readFileSafe(p) {
  try {
    const raw = await fs.readFile(p, "utf8");
    return { ok: true, raw };
  } catch (e) {
    return { ok: false, error: e?.code || e?.message || "read_failed" };
  }
}

function parseJsonSafe(raw) {
  try {
    const obj = JSON.parse(raw);
    return { ok: true, obj };
  } catch (e) {
    return { ok: false, error: e?.message || "parse_failed" };
  }
}

async function loadAgg() {
  const base = { updatedAt: null, byArtist: {} };
  const r = await readFileSafe(EVENTS_AGG_FILE);
  if (!r.ok) return base;

  const p = parseJsonSafe(r.raw);
  if (!p.ok || !p.obj || typeof p.obj !== "object") return base;

  if (!p.obj.byArtist || typeof p.obj.byArtist.byArtist === "object") {
    // ignore nested weirdness if any
  }
  if (!p.obj.byArtist || typeof p.obj.byArtist !== "object") p.obj.byArtist = {};
  return p.obj;
}

/** Artists store supports: array legacy OR canonical { artists: [] } */
function extractArtistsArray(store) {
  if (Array.isArray(store)) return store;
  if (!store || typeof store !== "object") return [];
  if (Array.isArray(store.artists)) return store.artists;
  if (store.data && Array.isArray(store.data.artists)) return store.data.artists;
  return [];
}

async function loadArtistsMap() {
  const base = { artists: [] };
  const r = await readFileSafe(ARTISTS_FILE);
  if (!r.ok) return { map: {}, count: 0, readOk: false, parseOk: false };

  const p = parseJsonSafe(r.raw);
  if (!p.ok) return { map: {}, count: 0, readOk: true, parseOk: false };

  const arr = extractArtistsArray(p.obj);
  const map = {};
  for (const a of arr) {
    if (a && typeof a === "object" && typeof a.id === "string" && a.id.trim()) {
      map[a.id.trim()] = a;
    }
  }
  return { map, count: Object.keys(map).length, readOk: true, parseOk: true };
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
 * Personalization v1 (session-based)
 * ----------------------------- */
function safeLineJson(line) {
  const s = (line || "").trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function readTailText(filePath, tailKb) {
  // Reads last N KB of file as utf8 text (Render-safe)
  const st = await statSafe(filePath);
  if (!st.ok) return { ok: false, error: st.error, text: "" };
  const size = st.size;
  const tailBytes = Math.max(1024, tailKb * 1024);
  const start = Math.max(0, size - tailBytes);

  try {
    const fh = await fs.open(filePath, "r");
    const len = size - start;
    const buf = Buffer.alloc(len);
    await fh.read(buf, 0, len, start);
    await fh.close();
    return { ok: true, text: buf.toString("utf8") };
  } catch (e) {
    return { ok: false, error: e?.code || e?.message || "tail_read_failed", text: "" };
  }
}

function buildSessionSignals(events, sessionId) {
  const byArtist = {}; // { [artistId]: { seen, engagedPoints, watchMs, views, replays, likes, saves, shares, follows, comments, votes } }

  for (const ev of events) {
    if (!ev || typeof ev !== "object") continue;
    if (!sessionId || ev.sessionId !== sessionId) continue;

    const artistId = typeof ev.artistId === "string" ? ev.artistId.trim() : "";
    if (!artistId) continue;

    if (!byArtist[artistId]) {
      byArtist[artistId] = {
        seen: 0,
        engagedPoints: 0,
        watchMs: 0,
        views: 0,
        replays: 0,
        likes: 0,
        saves: 0,
        shares: 0,
        follows: 0,
        comments: 0,
        votes: 0,
        lastAt: null,
      };
    }

    const a = byArtist[artistId];
    a.seen += 1;
    a.watchMs += safeNumber(ev.watchMs, 0);

    const t = typeof ev.type === "string" ? ev.type : "";
    if (t === "view") a.views += 1;
    if (t === "replay") a.replays += 1;
    if (t === "like") a.likes += 1;
    if (t === "save") a.saves += 1;
    if (t === "share") a.shares += 1;
    if (t === "follow") a.follows += 1;
    if (t === "comment") a.comments += 1;
    if (t === "vote") a.votes += 1;

    // Engagement points (simple, explainable)
    // watch: 1 point per 10s, replay: +4, like: +2, save: +5, share: +6, follow: +7, comment: +3, vote: +2
    a.engagedPoints += Math.floor(safeNumber(ev.watchMs, 0) / 10000);
    if (t === "replay") a.engagedPoints += 4;
    if (t === "like") a.engagedPoints += 2;
    if (t === "save") a.engagedPoints += 5;
    if (t === "share") a.engagedPoints += 6;
    if (t === "follow") a.engagedPoints += 7;
    if (t === "comment") a.engagedPoints += 3;
    if (t === "vote") a.engagedPoints += 2;

    const at = typeof ev.at === "string" ? ev.at : null;
    if (at) a.lastAt = at;
  }

  return byArtist;
}

function personalizationMultiplier(signal) {
  // Small boosts only (safe v1)
  // boost = 1 + clamp(log1p(points)/10, 0, 0.35)
  // fatigue penalty if seen a lot but low engagement: multiply by 0.92..1.0
  const points = safeNumber(signal?.engagedPoints, 0);
  const seen = safeNumber(signal?.seen, 0);

  const boost = 1 + clamp(Math.log1p(points) / 10, 0, 0.35);

  const lowEngagement = points <= 1;
  const fatigue = lowEngagement && seen >= 2 ? clamp(1 - (seen - 1) * 0.04, 0.84, 1.0) : 1.0;

  const mult = boost * fatigue;
  return Number(mult.toFixed(6));
}

/* -----------------------------
 * Middleware
 * ----------------------------- */
router.use(express.json({ limit: "64kb" }));

/* -----------------------------
 * Endpoints
 * ----------------------------- */
router.get("/health", async (_req, res) => {
  const artists = await loadArtistsMap();
  const logStat = await statSafe(EVENTS_LOG_FILE);

  res.json({
    success: true,
    service: "recs",
    version: routerVersion,
    updatedAt: nowIso(),
    sources: {
      dataDir: DATA_DIR,
      eventsAgg: path.basename(EVENTS_AGG_FILE),
      artistsFile: path.basename(ARTISTS_FILE),
      eventsLog: path.basename(EVENTS_LOG_FILE),
      artistsLoaded: artists.count,
      eventsLogOk: logStat.ok,
    },
    endpoints: {
      rising: "/api/recs/rising",
      personalized: "/api/recs/personalized",
    },
    maxReturn: MAX_RETURN,
  });
});

router.get("/rising", async (req, res) => {
  const limit = clamp(parseInt(req.query.limit || `${MAX_RETURN}`, 10) || MAX_RETURN, 1, MAX_RETURN);

  const [agg, artists] = await Promise.all([loadAgg(), loadArtistsMap()]);

  const rows = [];
  for (const [artistIdRaw, bucket] of Object.entries(agg.byArtist || {})) {
    const artistId = String(artistIdRaw || "").trim();
    const score = risingScoreFromBucket(bucket);
    const artist = artists.map[artistId] || null;

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
    artistsLoaded: artists.count,
    count: rows.length,
    results: rows.slice(0, limit),
  });
});

router.get("/personalized/health", async (_req, res) => {
  const logStat = await statSafe(EVENTS_LOG_FILE);
  res.json({
    success: true,
    service: "recs-personalized",
    version: 1,
    updatedAt: nowIso(),
    config: {
      tailKb: PERSONALIZE_TAIL_KB,
      maxLines: PERSONALIZE_MAX_LINES,
      eventLog: path.basename(EVENTS_LOG_FILE),
      eventLogOk: logStat.ok,
    },
  });
});

/**
 * GET /api/recs/personalized?sessionId=...&limit=20
 */
router.get("/personalized", async (req, res) => {
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId.trim() : "";
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      message: "sessionId query param is required.",
      example: "/api/recs/personalized?sessionId=sess_test_1&limit=20",
    });
  }

  const limit = clamp(parseInt(req.query.limit || `${MAX_RETURN}`, 10) || MAX_RETURN, 1, MAX_RETURN);

  const [agg, artists] = await Promise.all([loadAgg(), loadArtistsMap()]);

  // Build session signals from tail of jsonl
  const tail = await readTailText(EVENTS_LOG_FILE, PERSONALIZE_TAIL_KB);
  const lines = (tail.ok ? tail.text.split("\n") : []).slice(-PERSONALIZE_MAX_LINES);

  const parsed = [];
  for (const line of lines) {
    const obj = safeLineJson(line);
    if (obj) parsed.push(obj);
  }

  const signals = buildSessionSignals(parsed, sessionId);

  const rows = [];
  for (const [artistIdRaw, bucket] of Object.entries(agg.byArtist || {})) {
    const artistId = String(artistIdRaw || "").trim();
    const baseScore = risingScoreFromBucket(bucket);

    const sig = signals[artistId] || null;
    const mult = sig ? personalizationMultiplier(sig) : 1.0;

    const finalScore = Number((baseScore * mult).toFixed(6));

    const artist = artists.map[artistId] || null;

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
      score: finalScore,
      baseScore,
      multiplier: mult,
      lastAt: bucket.lastAt || null,
      explain: sig
        ? {
            sessionId,
            seen: sig.seen,
            engagedPoints: sig.engagedPoints,
            watchMs: sig.watchMs,
            views: sig.views,
            replays: sig.replays,
            likes: sig.likes,
            saves: sig.saves,
            shares: sig.shares,
            follows: sig.follows,
            comments: sig.comments,
            votes: sig.votes,
          }
        : { sessionId, seen: 0, engagedPoints: 0 },
    });
  }

  rows.sort((a, b) => b.score - a.score);

  res.json({
    success: true,
    updatedAt: agg.updatedAt || null,
    sessionId,
    artistsLoaded: artists.count,
    signalArtists: Object.keys(signals).length,
    count: rows.length,
    results: rows.slice(0, limit),
  });
});

export default router;