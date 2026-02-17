/**
 * recs.js (root) — ESM default export
 * iBand Feed Generator (v6.3 — taste-vector explore)
 *
 * v6.3 adds:
 * - Session taste vector (genre/location affinity) derived from session events
 * - Explore candidate scoring uses: unseen + underdog novelty + taste-match boosts
 * - Keeps v6.2 guarantee: at least 1 explore slot in /mix
 *
 * Endpoints unchanged:
 * - /api/recs/health
 * - /api/recs/rising
 * - /api/recs/personalized/health
 * - /api/recs/personalized
 * - /api/recs/mix/health
 * - /api/recs/mix
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
const PERSONALIZE_TAIL_KB = parseInt(process.env.PERSONALIZE_TAIL_KB || "512", 10);
const PERSONALIZE_MAX_LINES = parseInt(process.env.PERSONALIZE_MAX_LINES || "2500", 10);

// Mix controls
const MIX_EXPLORE_PCT = parseFloat(process.env.MIX_EXPLORE_PCT || "0.2");
const MIX_GENRE_CAP = parseInt(process.env.MIX_GENRE_CAP || "2", 10);
const MIX_LOCATION_CAP = parseInt(process.env.MIX_LOCATION_CAP || "3", 10);
const MIX_FATIGUE_STEP = parseFloat(process.env.MIX_FATIGUE_STEP || "0.04");
const MIX_FATIGUE_MIN = parseFloat(process.env.MIX_FATIGUE_MIN || "0.84");
const MIX_EXPLORE_NUDGE = parseFloat(process.env.MIX_EXPLORE_NUDGE || "1.02");

// Guarantee explore
const MIX_FORCE_EXPLORE_MIN = parseInt(process.env.MIX_FORCE_EXPLORE_MIN || "1", 10);

// Taste vector weights (simple, tunable)
const TASTE_GENRE_BOOST = parseFloat(process.env.TASTE_GENRE_BOOST || "2.0"); // strong
const TASTE_LOCATION_BOOST = parseFloat(process.env.TASTE_LOCATION_BOOST || "1.0"); // medium
const TASTE_WATCH_MS_PER_POINT = parseInt(process.env.TASTE_WATCH_MS_PER_POINT || "5000", 10); // watch contributes
const TASTE_TOP_K = parseInt(process.env.TASTE_TOP_K || "3", 10);

const routerVersion = 63;

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

  if (!p.obj.byArtist || typeof p.obj.byArtist !== "object") p.obj.byArtist = {};
  return p.obj;
}

/** Artists store supports: legacy array OR canonical { artists: [] } */
function extractArtistsArray(store) {
  if (Array.isArray(store)) return store;
  if (!store || typeof store !== "object") return [];
  if (Array.isArray(store.artists)) return store.artists;
  if (store.data && Array.isArray(store.data.artists)) return store.data.artists;
  return [];
}

function normKey(s) {
  return (s || "unknown").toString().toLowerCase().trim();
}

async function loadArtistsAll() {
  const r = await readFileSafe(ARTISTS_FILE);
  if (!r.ok) return { artists: [], readOk: false, parseOk: false };

  const p = parseJsonSafe(r.raw);
  if (!p.ok) return { artists: [], readOk: true, parseOk: false };

  const arr = extractArtistsArray(p.obj);
  const artists = arr
    .filter((a) => a && typeof a === "object" && typeof a.id === "string" && a.id.trim())
    .map((a) => ({
      id: a.id.trim(),
      name: a.name || null,
      imageUrl: a.imageUrl || null,
      genre: a.genre || null,
      location: a.location || null,
    }));

  return { artists, readOk: true, parseOk: true };
}

async function loadArtistsMap() {
  const all = await loadArtistsAll();
  const map = {};
  for (const a of all.artists) map[a.id] = a;
  return { map, count: all.artists.length, list: all.artists, readOk: all.readOk, parseOk: all.parseOk };
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
 * Session parsing + signals
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
  const byArtist = {};

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

/* -----------------------------
 * Taste vector (genre/location affinity)
 * ----------------------------- */
function eventEngagementPoints(ev) {
  const t = typeof ev.type === "string" ? ev.type : "";
  const watch = safeNumber(ev.watchMs, 0);
  const watchPts = Math.floor(watch / Math.max(1000, TASTE_WATCH_MS_PER_POINT));

  let pts = watchPts;
  if (t === "view") pts += 1;
  if (t === "replay") pts += 4;
  if (t === "like") pts += 3;
  if (t === "save") pts += 5;
  if (t === "share") pts += 6;
  if (t === "follow") pts += 7;
  if (t === "comment") pts += 3;
  if (t === "vote") pts += 2;

  return pts;
}

function buildTasteVector(sessionEvents, artistsMap) {
  const genreScore = {};
  const locScore = {};

  for (const ev of sessionEvents) {
    if (!ev || typeof ev !== "object") continue;
    const artistId = typeof ev.artistId === "string" ? ev.artistId.trim() : "";
    if (!artistId) continue;

    const a = artistsMap[artistId];
    if (!a) continue;

    const pts = eventEngagementPoints(ev);
    if (pts <= 0) continue;

    const g = normKey(a.genre);
    const l = normKey(a.location);

    if (g !== "unknown") genreScore[g] = (genreScore[g] || 0) + pts;
    if (l !== "unknown") locScore[l] = (locScore[l] || 0) + pts;
  }

  const topGenres = Object.entries(genreScore)
    .sort((a, b) => b[1] - a[1])
    .slice(0, clamp(TASTE_TOP_K, 1, 10))
    .map(([k]) => k);

  const topLocations = Object.entries(locScore)
    .sort((a, b) => b[1] - a[1])
    .slice(0, clamp(TASTE_TOP_K, 1, 10))
    .map(([k]) => k);

  return { topGenres, topLocations, genreScore, locScore };
}

/* -----------------------------
 * Multipliers
 * ----------------------------- */
function personalizationMultiplier(signal) {
  const points = safeNumber(signal?.engagedPoints, 0);
  const seen = safeNumber(signal?.seen, 0);

  const boost = 1 + clamp(Math.log1p(points) / 10, 0, 0.35);

  const lowEngagement = points <= 1;
  const fatigueLow = lowEngagement && seen >= 2 ? clamp(1 - (seen - 1) * 0.04, 0.84, 1.0) : 1.0;

  const mult = boost * fatigueLow;
  return Number(mult.toFixed(6));
}

function fatigueMultiplier(signal) {
  const seen = safeNumber(signal?.seen, 0);
  if (seen <= 1) return 1.0;
  const mult = clamp(1 - (seen - 1) * MIX_FATIGUE_STEP, MIX_FATIGUE_MIN, 1.0);
  return Number(mult.toFixed(6));
}

/* -----------------------------
 * Deterministic PRNG
 * ----------------------------- */
function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makePrng(seedStr) {
  let state = hash32(seedStr || "seed");
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/* -----------------------------
 * Diversity helpers
 * ----------------------------- */
function canAddWithDiversity(item, genreCount, locCount) {
  const g = normKey(item.artist?.genre);
  const l = normKey(item.artist?.location);

  if (g !== "unknown" && (genreCount[g] || 0) >= MIX_GENRE_CAP) return false;
  if (l !== "unknown" && (locCount[l] || 0) >= MIX_LOCATION_CAP) return false;
  return true;
}

function bumpDiversityCounts(item, genreCount, locCount) {
  const g = normKey(item.artist?.genre);
  const l = normKey(item.artist?.location);

  if (g !== "unknown") genreCount[g] = (genreCount[g] || 0) + 1;
  if (l !== "unknown") locCount[l] = (locCount[l] || 0) + 1;
}

/* -----------------------------
 * Catalog + Explore selection (taste-aware)
 * ----------------------------- */
function buildCatalogRows(artistsList, aggByArtist) {
  const rows = [];
  for (const a of artistsList) {
    const bucket = aggByArtist[a.id] || null;
    const baseScore = bucket ? risingScoreFromBucket(bucket) : 0;

    rows.push({
      artist: { ...a },
      baseScore,
      lastAt: bucket?.lastAt || null,
      metrics: bucket
        ? {
            views: safeNumber(bucket.views),
            replays: safeNumber(bucket.replays),
            likes: safeNumber(bucket.likes),
            saves: safeNumber(bucket.saves),
            shares: safeNumber(bucket.shares),
            follows: safeNumber(bucket.follows),
            comments: safeNumber(bucket.comments),
            votes: safeNumber(bucket.votes),
            watchMs: safeNumber(bucket.watchMs),
          }
        : { views: 0, replays: 0, likes: 0, saves: 0, shares: 0, follows: 0, comments: 0, votes: 0, watchMs: 0 },
    });
  }
  return rows;
}

function tasteBoostForArtist(artist, taste) {
  const g = normKey(artist?.genre);
  const l = normKey(artist?.location);

  let boost = 0;

  if (taste?.topGenres?.includes(g)) boost += TASTE_GENRE_BOOST;
  if (taste?.topLocations?.includes(l)) boost += TASTE_LOCATION_BOOST;

  return boost;
}

function pickExploreCandidate(catalogRows, signals, excludeIds, prng, taste) {
  // Explore score = unseenBoost + novelty + tasteBoost + tiny jitter
  const pool = catalogRows
    .filter((r) => {
      const id = r.artist?.id;
      if (!id) return false;
      if (excludeIds.has(id)) return false;
      return true;
    })
    .map((r) => {
      const id = r.artist.id;
      const base = safeNumber(r.baseScore, 0);

      const unseen = signals[id] ? 0 : 1; // unseen gets big bump
      const novelty = 1 / (1 + base); // underdog boost

      const tBoost = tasteBoostForArtist(r.artist, taste);

      const jitter = prng() * 0.0001;
      const score = unseen * 10 + novelty + tBoost + jitter;

      return { ...r, _exploreScore: score, _unseen: unseen === 1, _tBoost: tBoost };
    });

  if (!pool.length) return null;

  pool.sort((a, b) => b._exploreScore - a._exploreScore);
  return pool[0];
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
      artist: artist ? { ...artist } : { id: artistId },
      score,
      lastAt: bucket.lastAt || null,
      metrics: { views: safeNumber(bucket.views), replays: safeNumber(bucket.replays), watchMs: safeNumber(bucket.watchMs) },
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
      artist: artist ? { ...artist } : { id: artistId },
      score: finalScore,
      baseScore,
      multiplier: mult,
      lastAt: bucket.lastAt || null,
      explain: sig ? { sessionId, ...sig } : { sessionId, seen: 0, engagedPoints: 0 },
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

/* -----------------------------
 * Mix endpoints (taste-aware explore)
 * ----------------------------- */
router.get("/mix/health", async (_req, res) => {
  const logStat = await statSafe(EVENTS_LOG_FILE);
  res.json({
    success: true,
    service: "recs-mix",
    version: 23,
    updatedAt: nowIso(),
    config: {
      explorePct: MIX_EXPLORE_PCT,
      genreCap: MIX_GENRE_CAP,
      locationCap: MIX_LOCATION_CAP,
      fatigueStep: MIX_FATIGUE_STEP,
      fatigueMin: MIX_FATIGUE_MIN,
      exploreNudge: MIX_EXPLORE_NUDGE,
      forceExploreMin: MIX_FORCE_EXPLORE_MIN,
      taste: {
        genreBoost: TASTE_GENRE_BOOST,
        locationBoost: TASTE_LOCATION_BOOST,
        watchMsPerPoint: TASTE_WATCH_MS_PER_POINT,
        topK: TASTE_TOP_K,
      },
      tailKb: PERSONALIZE_TAIL_KB,
      maxLines: PERSONALIZE_MAX_LINES,
      eventLog: path.basename(EVENTS_LOG_FILE),
      eventLogOk: logStat.ok,
    },
  });
});

router.get("/mix", async (req, res) => {
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId.trim() : "";
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      message: "sessionId query param is required.",
      example: "/api/recs/mix?sessionId=sess_seed_1&limit=20",
    });
  }

  const limit = clamp(parseInt(req.query.limit || `${MAX_RETURN}`, 10) || MAX_RETURN, 1, MAX_RETURN);

  const [agg, artists] = await Promise.all([loadAgg(), loadArtistsMap()]);

  const tail = await readTailText(EVENTS_LOG_FILE, PERSONALIZE_TAIL_KB);
  const lines = (tail.ok ? tail.text.split("\n") : []).slice(-PERSONALIZE_MAX_LINES);

  const parsed = [];
  for (const line of lines) {
    const obj = safeLineJson(line);
    if (obj) parsed.push(obj);
  }

  const sessionEvents = parsed.filter((e) => e && typeof e === "object" && e.sessionId === sessionId);
  const signals = buildSessionSignals(parsed, sessionId);

  const taste = buildTasteVector(sessionEvents, artists.map);

  const prng = makePrng(sessionId);

  const catalogRows = buildCatalogRows(artists.list, agg.byArtist || {});

  // Ranked rows
  const rankedRows = [];
  for (const [artistIdRaw, bucket] of Object.entries(agg.byArtist || {})) {
    const artistId = String(artistIdRaw || "").trim();
    const artist = artists.map[artistId] || { id: artistId, name: null, imageUrl: null, genre: null, location: null };

    const baseScore = risingScoreFromBucket(bucket);
    const sig = signals[artistId] || null;

    const personalMult = sig ? personalizationMultiplier(sig) : 1.0;
    const fatMult = sig ? fatigueMultiplier(sig) : 1.0;

    const finalScore = Number((baseScore * personalMult * fatMult).toFixed(6));

    rankedRows.push({
      artist,
      score: finalScore,
      baseScore,
      multipliers: { personalization: personalMult, fatigue: fatMult },
      lastAt: bucket.lastAt || null,
      metrics: {
        views: safeNumber(bucket.views),
        replays: safeNumber(bucket.replays),
        likes: safeNumber(bucket.likes),
        saves: safeNumber(bucket.saves),
        shares: safeNumber(bucket.shares),
        follows: safeNumber(bucket.follows),
        comments: safeNumber(bucket.comments),
        votes: safeNumber(bucket.votes),
        watchMs: safeNumber(bucket.watchMs),
      },
      explain: sig ? { sessionId, ...sig } : { sessionId, seen: 0, engagedPoints: 0 },
      _source: "ranked",
    });
  }

  rankedRows.sort((a, b) => b.score - a.score);

  // Explore count (guarantee >=1)
  const computedExplore = Math.floor(limit * clamp(MIX_EXPLORE_PCT, 0, 0.5));
  const exploreCount = clamp(Math.max(MIX_FORCE_EXPLORE_MIN, computedExplore), 1, Math.max(1, Math.floor(limit / 2)));

  // Injection slots
  const injectSlots = [];
  for (let i = 3; i <= limit; i += 5) injectSlots.push(i);
  for (let i = injectSlots.length; i < exploreCount; i++) {
    const slot = clamp(limit - i, 1, limit);
    if (!injectSlots.includes(slot)) injectSlots.push(slot);
  }
  injectSlots.sort((a, b) => a - b);

  const chosen = [];
  const chosenIds = new Set();
  const genreCount = {};
  const locCount = {};

  function addItem(item, sourceTag) {
    bumpDiversityCounts(item, genreCount, locCount);
    chosenIds.add(item.artist.id);
    chosen.push({
      artist: item.artist,
      score: item.score,
      baseScore: item.baseScore,
      multipliers: item.multipliers,
      lastAt: item.lastAt,
      metrics: item.metrics,
      source: sourceTag,
      explain: item.explain,
    });
  }

  let rankedIdx = 0;
  let exploreUsed = 0;

  for (let slot = 1; slot <= limit; slot++) {
    const isExploreSlot = injectSlots.includes(slot) && exploreUsed < exploreCount;

    if (isExploreSlot) {
      const candidate = pickExploreCandidate(catalogRows, signals, chosenIds, prng, taste);

      if (candidate) {
        const baseScore = safeNumber(candidate.baseScore, 0);
        const exploreRow = {
          artist: candidate.artist,
          baseScore,
          score: Number((baseScore * MIX_EXPLORE_NUDGE).toFixed(6)),
          multipliers: { personalization: 1.0, fatigue: 1.0 },
          lastAt: candidate.lastAt || null,
          metrics: candidate.metrics,
          explain: {
            sessionId,
            seen: 0,
            engagedPoints: 0,
            explore: true,
            taste: {
              topGenres: taste.topGenres,
              topLocations: taste.topLocations,
            },
          },
        };

        if (canAddWithDiversity(exploreRow, genreCount, locCount)) {
          addItem(exploreRow, "explore");
        } else {
          addItem(exploreRow, "explore-relaxed");
        }

        exploreUsed++;
        continue;
      }
    }

    // ranked fill
    let placed = false;
    while (rankedIdx < rankedRows.length) {
      const r = rankedRows[rankedIdx++];
      const id = r?.artist?.id;
      if (!id || chosenIds.has(id)) continue;

      if (canAddWithDiversity(r, genreCount, locCount)) {
        addItem(r, "ranked");
        placed = true;
        break;
      }
    }

    if (!placed) {
      while (rankedIdx < rankedRows.length) {
        const r = rankedRows[rankedIdx++];
        const id = r?.artist?.id;
        if (!id || chosenIds.has(id)) continue;

        addItem(r, "ranked-relaxed");
        placed = true;
        break;
      }
    }

    if (!placed) {
      const filler = pickExploreCandidate(catalogRows, signals, chosenIds, prng, taste);
      if (filler) {
        const baseScore = safeNumber(filler.baseScore, 0);
        addItem(
          {
            artist: filler.artist,
            baseScore,
            score: Number((baseScore * 1.0).toFixed(6)),
            multipliers: { personalization: 1.0, fatigue: 1.0 },
            lastAt: filler.lastAt || null,
            metrics: filler.metrics,
            explain: { sessionId, filler: true },
          },
          "fill"
        );
      }
    }
  }

  // Guarantee (swap) if somehow explore not used
  if (exploreUsed < MIX_FORCE_EXPLORE_MIN && chosen.length) {
    const swapSlot = injectSlots[0] ? clamp(injectSlots[0], 1, chosen.length) : 1;
    const idx = swapSlot - 1;

    const excludeIds = new Set(chosenIds);
    const candidate = pickExploreCandidate(catalogRows, signals, excludeIds, prng, taste);

    if (candidate) {
      const baseScore = safeNumber(candidate.baseScore, 0);
      chosen[idx] = {
        artist: candidate.artist,
        score: Number((baseScore * MIX_EXPLORE_NUDGE).toFixed(6)),
        baseScore,
        multipliers: { personalization: 1.0, fatigue: 1.0 },
        lastAt: candidate.lastAt || null,
        metrics: candidate.metrics,
        source: "explore-swap",
        explain: {
          sessionId,
          explore: true,
          swap: true,
          taste: {
            topGenres: taste.topGenres,
            topLocations: taste.topLocations,
          },
        },
      };
    }
  }

  res.json({
    success: true,
    updatedAt: agg.updatedAt || null,
    sessionId,
    artistsLoaded: artists.count,
    signalArtists: Object.keys(signals).length,
    taste: { topGenres: taste.topGenres, topLocations: taste.topLocations },
    config: {
      explorePct: MIX_EXPLORE_PCT,
      exploreCount,
      genreCap: MIX_GENRE_CAP,
      locationCap: MIX_LOCATION_CAP,
      fatigueStep: MIX_FATIGUE_STEP,
      fatigueMin: MIX_FATIGUE_MIN,
      exploreNudge: MIX_EXPLORE_NUDGE,
      forceExploreMin: MIX_FORCE_EXPLORE_MIN,
      injectSlots,
    },
    count: chosen.length,
    results: chosen,
  });
});

export default router;