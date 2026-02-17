/**
 * recs.js (root) — ESM default export
 * iBand Feed Generator (v6 — mix: rising + personalized + exploration + diversity)
 *
 * Keeps:
 * - /api/recs/health
 * - /api/recs/rising
 * - /api/recs/personalized/health
 * - /api/recs/personalized
 *
 * Adds:
 * - /api/recs/mix/health
 * - /api/recs/mix?sessionId=...&limit=...
 *
 * Feed Intelligence v2 goals:
 * - Preserve engagement-weighted ranking (baseScore)
 * - Add session personalization (multiplier)
 * - Add exploration injection (discover new / low-signal artists)
 * - Add diversity caps (genre/location) to prevent winner-takes-all
 * - Add fatigue control (light penalty for repeated seen in session)
 *
 * Deterministic:
 * - Exploration selection uses a seeded PRNG from sessionId
 * - Same sessionId yields stable mix ordering for the same data
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

// Mix v2 controls
const MIX_EXPLORE_PCT = parseFloat(process.env.MIX_EXPLORE_PCT || "0.2"); // 20% slots
const MIX_GENRE_CAP = parseInt(process.env.MIX_GENRE_CAP || "2", 10); // max per genre in list
const MIX_LOCATION_CAP = parseInt(process.env.MIX_LOCATION_CAP || "3", 10); // max per location in list (light cap)
const MIX_FATIGUE_STEP = parseFloat(process.env.MIX_FATIGUE_STEP || "0.04"); // penalty per extra seen
const MIX_FATIGUE_MIN = parseFloat(process.env.MIX_FATIGUE_MIN || "0.84"); // clamp floor

const routerVersion = 6;

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

async function loadArtistsMap() {
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

    // Engagement points (simple, explainable)
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
  const points = safeNumber(signal?.engagedPoints, 0);
  const seen = safeNumber(signal?.seen, 0);

  const boost = 1 + clamp(Math.log1p(points) / 10, 0, 0.35);

  const lowEngagement = points <= 1;
  const fatigue = lowEngagement && seen >= 2 ? clamp(1 - (seen - 1) * 0.04, 0.84, 1.0) : 1.0;

  const mult = boost * fatigue;
  return Number(mult.toFixed(6));
}

function fatigueMultiplier(signal) {
  // Applies even when engagement exists (light, controlled)
  const seen = safeNumber(signal?.seen, 0);
  if (seen <= 1) return 1.0;
  const mult = clamp(1 - (seen - 1) * MIX_FATIGUE_STEP, MIX_FATIGUE_MIN, 1.0);
  return Number(mult.toFixed(6));
}

/* -----------------------------
 * Deterministic PRNG (seeded by sessionId)
 * ----------------------------- */
function hash32(str) {
  // FNV-1a 32-bit
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
    // LCG
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/* -----------------------------
 * Mix v2 logic
 * ----------------------------- */
function pickExploreCandidates(allRows, sessionSignals, exploreCount, prng) {
  // Choose from lowest-baseScore / lowest-signal artists (novelty)
  // Novelty score favors low baseScore and unseen in session.
  const candidates = allRows
    .filter((r) => {
      const id = r.artist?.id;
      return id && !sessionSignals[id]; // unseen in session
    })
    .map((r) => {
      const base = safeNumber(r.baseScore, 0);
      // higher novelty when base is small (underdogs)
      const novelty = 1 / (1 + base);
      return { ...r, _novelty: novelty };
    });

  // Sort by novelty desc then shuffle top slice deterministically
  candidates.sort((a, b) => b._novelty - a._novelty);

  const pool = candidates.slice(0, Math.max(10, exploreCount * 8));
  // deterministic shuffle using prng
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, exploreCount);
}

function canAddWithDiversity(item, genreCount, locCount) {
  const g = (item.artist?.genre || "unknown").toLowerCase().trim();
  const l = (item.artist?.location || "unknown").toLowerCase().trim();

  if (g !== "unknown" && genreCount[g] >= MIX_GENRE_CAP) return false;
  if (l !== "unknown" && locCount[l] >= MIX_LOCATION_CAP) return false;
  return true;
}

function bumpDiversityCounts(item, genreCount, locCount) {
  const g = (item.artist?.genre || "unknown").toLowerCase().trim();
  const l = (item.artist?.location || "unknown").toLowerCase().trim();

  if (g !== "unknown") genreCount[g] = (genreCount[g] || 0) + 1;
  if (l !== "unknown") locCount[l] = (locCount[l] || 0) + 1;
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
      mix: "/api/recs/mix",
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
      artist: artist
        ? { id: artist.id, name: artist.name || null, imageUrl: artist.imageUrl || null, genre: artist.genre || null, location: artist.location || null }
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

/* -----------------------------
 * Mix v2 endpoints
 * ----------------------------- */
router.get("/mix/health", async (_req, res) => {
  const logStat = await statSafe(EVENTS_LOG_FILE);
  res.json({
    success: true,
    service: "recs-mix",
    version: 2,
    updatedAt: nowIso(),
    config: {
      explorePct: MIX_EXPLORE_PCT,
      genreCap: MIX_GENRE_CAP,
      locationCap: MIX_LOCATION_CAP,
      fatigueStep: MIX_FATIGUE_STEP,
      fatigueMin: MIX_FATIGUE_MIN,
      tailKb: PERSONALIZE_TAIL_KB,
      maxLines: PERSONALIZE_MAX_LINES,
      eventLog: path.basename(EVENTS_LOG_FILE),
      eventLogOk: logStat.ok,
    },
  });
});

/**
 * GET /api/recs/mix?sessionId=...&limit=20
 *
 * Returns a blended feed list:
 * - Primary: base rising score
 * - Personalized: session multiplier
 * - Fatigue: gentle penalty on repeats in session
 * - Exploration: inject underdogs/unseen picks
 * - Diversity: cap genre/location dominance
 */
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

  // session signals
  const tail = await readTailText(EVENTS_LOG_FILE, PERSONALIZE_TAIL_KB);
  const lines = (tail.ok ? tail.text.split("\n") : []).slice(-PERSONALIZE_MAX_LINES);

  const parsed = [];
  for (const line of lines) {
    const obj = safeLineJson(line);
    if (obj) parsed.push(obj);
  }
  const signals = buildSessionSignals(parsed, sessionId);

  // build base rows
  const allRows = [];
  for (const [artistIdRaw, bucket] of Object.entries(agg.byArtist || {})) {
    const artistId = String(artistIdRaw || "").trim();
    const baseScore = risingScoreFromBucket(bucket);
    const sig = signals[artistId] || null;

    const personalMult = sig ? personalizationMultiplier(sig) : 1.0;
    const fatMult = sig ? fatigueMultiplier(sig) : 1.0;

    const finalScore = Number((baseScore * personalMult * fatMult).toFixed(6));

    const artist = artists.map[artistId] || null;

    allRows.push({
      artist: artist
        ? { id: artist.id, name: artist.name || null, imageUrl: artist.imageUrl || null, genre: artist.genre || null, location: artist.location || null }
        : { id: artistId },
      score: finalScore,
      baseScore,
      multipliers: {
        personalization: personalMult,
        fatigue: fatMult,
      },
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
      _source: "ranked",
    });
  }

  // Sort by finalScore desc as baseline
  allRows.sort((a, b) => b.score - a.score);

  // Exploration slots
  const exploreCount = clamp(Math.floor(limit * clamp(MIX_EXPLORE_PCT, 0, 0.5)), 1, Math.max(1, Math.floor(limit / 2)));
  const prng = makePrng(sessionId);
  const explorePicks = pickExploreCandidates(allRows, signals, exploreCount, prng).map((r) => ({
    ...r,
    _source: "explore",
    // tiny nudge so explore picks can surface but not dominate:
    score: Number((r.score * 1.02).toFixed(6)),
  }));

  // Build final mixed list with diversity
  const chosen = [];
  const seenIds = new Set();
  const genreCount = {};
  const locCount = {};

  // positions to inject explore: every 5th slot, starting at slot 3 (1-indexed)
  const injectSlots = new Set();
  for (let i = 3; i <= limit; i += 5) injectSlots.add(i);

  let exploreIdx = 0;
  let rankedIdx = 0;

  function tryAdd(item, sourceTag) {
    const id = item?.artist?.id;
    if (!id || seenIds.has(id)) return false;
    if (!canAddWithDiversity(item, genreCount, locCount)) return false;

    bumpDiversityCounts(item, genreCount, locCount);
    seenIds.add(id);

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

    return true;
  }

  // First pass: construct list with planned explore injections
  while (chosen.length < limit && (rankedIdx < allRows.length || exploreIdx < explorePicks.length)) {
    const slot = chosen.length + 1;

    const shouldInjectExplore = injectSlots.has(slot) && exploreIdx < explorePicks.length;

    if (shouldInjectExplore) {
      const ex = explorePicks[exploreIdx++];
      if (tryAdd(ex, "explore")) continue;
      // if couldn't add due to diversity, keep going and try ranked
    }

    // ranked fill
    while (rankedIdx < allRows.length) {
      const r = allRows[rankedIdx++];
      if (tryAdd(r, "ranked")) break;
    }

    // if ranked exhausted, try explore remaining
    if (rankedIdx >= allRows.length && exploreIdx < explorePicks.length) {
      const ex = explorePicks[exploreIdx++];
      tryAdd(ex, "explore");
    }

    // safety break if we can't progress
    if (rankedIdx >= allRows.length && exploreIdx >= explorePicks.length) break;
  }

  // Second pass fallback: if diversity caps were too strict, relax by allowing "unknown" caps only (already allowed)
  // If still short, append ignoring diversity (last resort) to prevent empty feeds.
  if (chosen.length < limit) {
    for (const r of allRows) {
      if (chosen.length >= limit) break;
      const id = r?.artist?.id;
      if (!id || seenIds.has(id)) continue;

      // Ignore diversity last resort
      seenIds.add(id);
      chosen.push({
        artist: r.artist,
        score: r.score,
        baseScore: r.baseScore,
        multipliers: r.multipliers,
        lastAt: r.lastAt,
        metrics: r.metrics,
        source: "ranked-relaxed",
        explain: r.explain,
      });
    }
  }

  res.json({
    success: true,
    updatedAt: agg.updatedAt || null,
    sessionId,
    artistsLoaded: artists.count,
    signalArtists: Object.keys(signals).length,
    config: {
      explorePct: MIX_EXPLORE_PCT,
      exploreCount,
      genreCap: MIX_GENRE_CAP,
      locationCap: MIX_LOCATION_CAP,
      fatigueStep: MIX_FATIGUE_STEP,
      fatigueMin: MIX_FATIGUE_MIN,
    },
    count: chosen.length,
    results: chosen,
  });
});

export default router;