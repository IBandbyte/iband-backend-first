/**
 * medals.js (root) — ESM default export router
 * iBand Medals Engine (v2.0) — Global Unlock + Prestige Protection
 *
 * Captain’s Protocol:
 * - Full canonical file (no snippets)
 * - Render-safe (tail-read jsonl, no full file loads)
 * - Never breaks: graceful fallbacks everywhere
 * - Exposes both API endpoints + helper exports (for recs.js integration)
 *
 * Core idea:
 * - Until platform is "ready", EVERY artist shows Certified 🎸 only.
 * - Once ready, medals unlock by rank percentile (Top 5% Gold, etc)
 *
 * Unlock readiness uses (Combined):
 * - events-agg.json => totals (votes + metrics)
 * - events.jsonl tail => unique session count (fans)
 * - artists.json => active artist count
 *
 * Endpoints:
 * - GET /api/medals/health
 * - GET /api/medals/unlock-status
 * - GET /api/medals/artist/:artistId
 * - GET /api/medals/table?limit=50
 */

import express from "express";
import fs from "fs/promises";
import fssync from "fs";
import path from "path";
import crypto from "crypto";

const router = express.Router();

// -------------------- Env / Paths --------------------
const DATA_DIR = process.env.DATA_DIR || "/var/data/iband/db";

const EVENTS_AGG_FILE =
  process.env.EVENTS_AGG_FILE || path.join(DATA_DIR, "events-agg.json");

const EVENTS_LOG_FILE =
  process.env.EVENTS_LOG_FILE || path.join(DATA_DIR, "events.jsonl");

const ARTISTS_FILE =
  process.env.ARTISTS_FILE || path.join(DATA_DIR, "artists.json");

// -------------------- Tunables (Safe Defaults) --------------------
// Medal scoring weights (same family as ranking)
const WATCHMS_PER_POINT = parseInt(process.env.MEDALS_WATCHMS_PER_POINT || "10000", 10);

const W_VIEW = parseFloat(process.env.MEDALS_W_VIEW || "1.0");
const W_REPLAY = parseFloat(process.env.MEDALS_W_REPLAY || "2.5");
const W_LIKE = parseFloat(process.env.MEDALS_W_LIKE || "1.5");
const W_SAVE = parseFloat(process.env.MEDALS_W_SAVE || "3.5");
const W_SHARE = parseFloat(process.env.MEDALS_W_SHARE || "4.5");
const W_FOLLOW = parseFloat(process.env.MEDALS_W_FOLLOW || "5.0");
const W_COMMENT = parseFloat(process.env.MEDALS_W_COMMENT || "2.0");
const W_VOTE = parseFloat(process.env.MEDALS_W_VOTE || "1.0");

// Mild freshness floor so very old content doesn’t “die” for medals (prestige)
const FRESHNESS_FLOOR = parseFloat(process.env.MEDALS_FRESHNESS_FLOOR || "0.65");
const HALF_LIFE_HOURS = parseFloat(process.env.MEDALS_HALF_LIFE_HOURS || "24");

// Medal tiers by percentile (when unlocked)
const GOLD_TOP_PCT = parseFloat(process.env.MEDALS_GOLD_TOP_PCT || "0.05");
const SILVER_TOP_PCT = parseFloat(process.env.MEDALS_SILVER_TOP_PCT || "0.20");
const BRONZE_TOP_PCT = parseFloat(process.env.MEDALS_BRONZE_TOP_PCT || "0.50");

// Certified default always true (locked mode)
const CERTIFIED_REST = String(process.env.MEDALS_CERTIFIED_REST || "true") === "true";

// Unlock thresholds (prestige protection)
const UNLOCK_MIN_TOTAL_VOTES = parseInt(process.env.MEDALS_UNLOCK_MIN_TOTAL_VOTES || "250", 10);
const UNLOCK_MIN_UNIQUE_SESSIONS = parseInt(process.env.MEDALS_UNLOCK_MIN_UNIQUE_SESSIONS || "50", 10);
const UNLOCK_MIN_ACTIVE_ARTISTS = parseInt(process.env.MEDALS_UNLOCK_MIN_ACTIVE_ARTISTS || "15", 10);

// Render-safe tail reading
const TAIL_KB = parseInt(process.env.MEDALS_TAIL_KB || "512", 10);
const MAX_LINES = parseInt(process.env.MEDALS_MAX_LINES || "4000", 10);

// Caching
const CACHE_TTL_MS = parseInt(process.env.MEDALS_CACHE_TTL_MS || "30000", 10);
const MAX_RETURN = parseInt(process.env.MEDALS_MAX_RETURN || "50", 10);

// Router version
const SERVICE = "medals";
const VERSION = 2;

// -------------------- Medal Styles --------------------
const MEDAL_STYLES = {
  platinum: { tier: "platinum", label: "Platinum", emoji: "🏆", hex: "#7FDBFF" },
  gold: { tier: "gold", label: "Gold", emoji: "🥇", hex: "#D4AF37" },
  silver: { tier: "silver", label: "Silver", emoji: "🥈", hex: "#C0C0C0" },
  bronze: { tier: "bronze", label: "Bronze", emoji: "🥉", hex: "#CD7F32" },
  certified: { tier: "certified", label: "Certified", emoji: "🎸", hex: "#6C63FF" }, // starter badge
  unranked: { tier: "unranked", label: "Unranked", emoji: "⬛", hex: "#111111" }, // optional future use
};

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

async function statOk(p) {
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

// Wrapper-aware extraction for artists.json
function extractArtistsArray(parsed) {
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed;

  if (parsed && typeof parsed === "object") {
    const candidates = ["artists", "data", "items", "results", "list"];
    for (const k of candidates) {
      const v = parsed[k];
      if (Array.isArray(v)) return v;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const vals = Object.values(v).filter((x) => x && typeof x === "object");
        if (vals.length) return vals;
      }
    }

    // keyed object at top-level
    const vals = Object.values(parsed).filter((x) => x && typeof x === "object");
    if (vals.length && !(("id" in parsed) && ("name" in parsed))) {
      return vals;
    }
  }

  return [];
}

async function loadArtists() {
  const base = { artists: [] };
  const parsed = await readJsonSafe(ARTISTS_FILE, base);

  const rawArr = extractArtistsArray(parsed);
  const normalized = rawArr
    .map((x) => ({
      id: String(x?.id || "").trim(),
      name: x?.name ?? null,
      genre: x?.genre ?? null,
      location: x?.location ?? null,
      imageUrl: x?.imageUrl ?? null,
      status: x?.status ?? "active",
      createdAt: x?.createdAt ?? null,
      updatedAt: x?.updatedAt ?? null,
    }))
    .filter((x) => x.id);

  const byId = {};
  for (const a of normalized) byId[a.id] = a;

  return { ok: true, artists: normalized, byId };
}

async function loadAgg() {
  const base = { version: 1, updatedAt: null, byArtist: {}, artists: {} };
  const agg = await readJsonSafe(EVENTS_AGG_FILE, base);

  // Support either v2 shape (byArtist) or older shape (artists)
  if (agg && typeof agg === "object") {
    if (!agg.byArtist && agg.artists && typeof agg.artists === "object") {
      // convert legacy to byArtist-ish
      agg.byArtist = {};
      for (const [id, row] of Object.entries(agg.artists)) {
        agg.byArtist[id] = row;
      }
    }
    if (!agg.byArtist || typeof agg.byArtist !== "object") agg.byArtist = {};
  }

  return { ok: true, agg };
}

// Tail-read jsonl (Render-safe)
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
          // ignore bad line
        }
      }

      return { ok: true, events, linesParsed: tail.length, error: null };
    } finally {
      await fh.close();
    }
  } catch (e) {
    return { ok: false, events: [], linesParsed: 0, error: e?.code || String(e) };
  }
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

function scoreWeightedFromBucket(bucket) {
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
    votes,
  };
}

// -------------------- Unlock Readiness (Combined) --------------------
function calcTotalVotesFromAgg(aggByArtist) {
  let totalVotes = 0;
  for (const bucket of Object.values(aggByArtist || {})) {
    // Support either bucket.votes or bucket.lifetime.votes depending on shape
    const v =
      safeNumber(bucket?.votes, NaN);
    if (Number.isFinite(v)) totalVotes += v;
    else totalVotes += safeNumber(bucket?.lifetime?.votes, 0);
  }
  return totalVotes;
}

function calcActiveArtists(artists) {
  return (artists || []).filter((a) => (a?.status || "active") !== "deleted").length;
}

function calcUniqueVoteSessionsFromEvents(events) {
  const set = new Set();
  for (const ev of events || []) {
    const type = String(ev?.type || "").toLowerCase().trim();
    if (type !== "vote") continue;
    const sid = String(ev?.sessionId || "").trim();
    if (sid) set.add(sid);
  }
  return set.size;
}

function buildUnlockStatus({ totalVotes, uniqueVoteSessions, activeArtists }) {
  const req = {
    minTotalVotes: UNLOCK_MIN_TOTAL_VOTES,
    minUniqueVoteSessions: UNLOCK_MIN_UNIQUE_SESSIONS,
    minActiveArtists: UNLOCK_MIN_ACTIVE_ARTISTS,
  };

  const progress = {
    totalVotes: {
      have: totalVotes,
      need: req.minTotalVotes,
      pct: req.minTotalVotes > 0 ? clamp(totalVotes / req.minTotalVotes, 0, 1) : 1,
      ok: totalVotes >= req.minTotalVotes,
    },
    uniqueVoteSessions: {
      have: uniqueVoteSessions,
      need: req.minUniqueVoteSessions,
      pct: req.minUniqueVoteSessions > 0
        ? clamp(uniqueVoteSessions / req.minUniqueVoteSessions, 0, 1)
        : 1,
      ok: uniqueVoteSessions >= req.minUniqueVoteSessions,
    },
    activeArtists: {
      have: activeArtists,
      need: req.minActiveArtists,
      pct: req.minActiveArtists > 0 ? clamp(activeArtists / req.minActiveArtists, 0, 1) : 1,
      ok: activeArtists >= req.minActiveArtists,
    },
  };

  const unlocked = Boolean(
    progress.totalVotes.ok &&
    progress.uniqueVoteSessions.ok &&
    progress.activeArtists.ok
  );

  // overall percent = average of 3 signals
  const overallPct =
    (progress.totalVotes.pct + progress.uniqueVoteSessions.pct + progress.activeArtists.pct) / 3;

  return {
    medalsUnlocked: unlocked,
    overallPct: Number(overallPct.toFixed(6)),
    requirements: req,
    progress,
  };
}

// -------------------- Cached Medal Table --------------------
let CACHE = {
  atMs: 0,
  unlockStatus: null,
  table: null, // array rows
  byArtist: null, // map artistId -> row
  meta: null,
};

function cacheFresh() {
  return Date.now() - (CACHE.atMs || 0) <= CACHE_TTL_MS;
}

function resetCache() {
  CACHE = { atMs: 0, unlockStatus: null, table: null, byArtist: null, meta: null };
}

function medalForRankPercentile(p01) {
  // p01 in [0,1), smaller is better
  if (p01 < GOLD_TOP_PCT) return MEDAL_STYLES.gold;
  if (p01 < SILVER_TOP_PCT) return MEDAL_STYLES.silver;
  if (p01 < BRONZE_TOP_PCT) return MEDAL_STYLES.bronze;
  return CERTIFIED_REST ? MEDAL_STYLES.certified : MEDAL_STYLES.unranked;
}

async function buildMedalTableInternal() {
  const [artistsLoad, aggLoad, tail] = await Promise.all([
    loadArtists(),
    loadAgg(),
    readJsonlTail(EVENTS_LOG_FILE, TAIL_KB, MAX_LINES),
  ]);

  const artists = artistsLoad.ok ? artistsLoad.artists : [];
  const artistsById = artistsLoad.ok ? artistsLoad.byId : {};

  const agg = aggLoad.ok ? aggLoad.agg : { updatedAt: null, byArtist: {} };
  const byArtist = agg?.byArtist || {};

  const totalVotes = calcTotalVotesFromAgg(byArtist);
  const uniqueVoteSessions = tail.ok ? calcUniqueVoteSessionsFromEvents(tail.events) : 0;
  const activeArtists = calcActiveArtists(artists);

  const unlockStatus = buildUnlockStatus({ totalVotes, uniqueVoteSessions, activeArtists });

  // Build scoring rows (for ranking order) using agg buckets
  const rows = [];
  for (const a of artists) {
    const bucket = byArtist?.[a.id] || byArtist?.[String(a.id)] || null;

    const lifetime = bucket?.lifetime && typeof bucket.lifetime === "object"
      ? bucket.lifetime
      : bucket && typeof bucket === "object"
        ? bucket
        : {};

    const lastAt =
      bucket?.lastAt ||
      lifetime?.lastAt ||
      null;

    const scoreExplain = scoreWeightedFromBucket({
      views: lifetime?.views ?? bucket?.views,
      replays: lifetime?.replays ?? bucket?.replays,
      likes: lifetime?.likes ?? bucket?.likes,
      saves: lifetime?.saves ?? bucket?.saves,
      shares: lifetime?.shares ?? bucket?.shares,
      follows: lifetime?.follows ?? bucket?.follows,
      comments: lifetime?.comments ?? bucket?.comments,
      votes: lifetime?.votes ?? bucket?.votes,
      watchMs: lifetime?.watchMs ?? bucket?.watchMs,
    });

    const rawFreshness = decayMultiplier(lastAt, HALF_LIFE_HOURS);
    const appliedFreshness = Math.max(FRESHNESS_FLOOR, rawFreshness);

    // prestige-stable score: weighted * freshness floor
    const score = Number((scoreExplain.weighted * appliedFreshness).toFixed(6));

    rows.push({
      artistId: a.id,
      artist: {
        id: a.id,
        name: a.name,
        imageUrl: a.imageUrl,
        genre: a.genre,
        location: a.location,
      },
      score,
      lastAt: lastAt || null,
      lifetime: {
        views: safeNumber(lifetime?.views ?? bucket?.views, 0),
        replays: safeNumber(lifetime?.replays ?? bucket?.replays, 0),
        likes: safeNumber(lifetime?.likes ?? bucket?.likes, 0),
        saves: safeNumber(lifetime?.saves ?? bucket?.saves, 0),
        shares: safeNumber(lifetime?.shares ?? bucket?.shares, 0),
        follows: safeNumber(lifetime?.follows ?? bucket?.follows, 0),
        comments: safeNumber(lifetime?.comments ?? bucket?.comments, 0),
        votes: safeNumber(lifetime?.votes ?? bucket?.votes, 0),
        watchMs: safeNumber(lifetime?.watchMs ?? bucket?.watchMs, 0),
      },
      explain: {
        basis: "stable-trending-like (bucket weighted * freshness floor)",
        scoreExplain: {
          weighted: scoreExplain.weighted,
          rawFreshness: Number(rawFreshness.toFixed(6)),
          appliedFreshness: Number(appliedFreshness.toFixed(6)),
          floor: FRESHNESS_FLOOR,
          watchPoints: scoreExplain.watchPoints,
          lastAt,
        },
        unlockStatus,
      },
    });
  }

  // Sort best first
  rows.sort((a, b) => b.score - a.score);

  // Assign rank + medals
  const total = rows.length || 1;
  const byArtistOut = {};

  for (let i = 0; i < rows.length; i++) {
    const rank = i + 1;
    const p01 = i / total; // 0 is best

    let medal = MEDAL_STYLES.certified;

    if (unlockStatus.medalsUnlocked) {
      medal = medalForRankPercentile(p01);
    } else {
      medal = MEDAL_STYLES.certified; // global lock protection
    }

    const row = {
      ...rows[i],
      rank,
      total,
      percentile01: Number(p01.toFixed(6)),
      medal,
    };

    byArtistOut[row.artistId] = row;
    rows[i] = row;
  }

  const meta = {
    service: SERVICE,
    version: VERSION,
    updatedAt: nowIso(),
    aggUpdatedAt: agg?.updatedAt || null,
    artistsUpdatedAt: null,
    sources: {
      dataDir: DATA_DIR,
      eventsAgg: {
        path: EVENTS_AGG_FILE,
        stat: await statOk(EVENTS_AGG_FILE),
      },
      eventsLog: {
        path: EVENTS_LOG_FILE,
        stat: await statOk(EVENTS_LOG_FILE),
        tail: {
          ok: tail.ok,
          linesParsed: tail.linesParsed,
          error: tail.error || null,
        },
      },
      artistsFile: {
        path: ARTISTS_FILE,
        stat: await statOk(ARTISTS_FILE),
      },
      artistsLoaded: artists.length,
      totalConsidered: rows.length,
      cacheTtlMs: CACHE_TTL_MS,
    },
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
        goldTopPct: GOLD_TOP_PCT,
        silverTopPct: SILVER_TOP_PCT,
        bronzeTopPct: BRONZE_TOP_PCT,
        certifiedRest: CERTIFIED_REST,
      },
      unlock: {
        minTotalVotes: UNLOCK_MIN_TOTAL_VOTES,
        minUniqueVoteSessions: UNLOCK_MIN_UNIQUE_SESSIONS,
        minActiveArtists: UNLOCK_MIN_ACTIVE_ARTISTS,
        mode: "combined (agg totals + jsonl unique sessions + artists active)",
      },
    },
    unlockStatus,
  };

  return { unlockStatus, table: rows, byArtist: byArtistOut, meta };
}

async function getCachedTable() {
  if (cacheFresh() && CACHE.table && CACHE.byArtist && CACHE.unlockStatus) {
    return { ok: true, ...CACHE };
  }

  const built = await buildMedalTableInternal();
  CACHE.atMs = Date.now();
  CACHE.unlockStatus = built.unlockStatus;
  CACHE.table = built.table;
  CACHE.byArtist = built.byArtist;
  CACHE.meta = built.meta;

  return { ok: true, ...CACHE };
}

// -------------------- Exported helpers (for recs.js etc) --------------------
export async function buildMedalTable() {
  const cached = await getCachedTable();
  return {
    unlockStatus: cached.unlockStatus,
    table: cached.table,
    meta: cached.meta,
  };
}

export async function getUnlockStatus() {
  const cached = await getCachedTable();
  return cached.unlockStatus;
}

export async function getMedalForArtist(artistId) {
  const id = String(artistId || "").trim();
  if (!id) return MEDAL_STYLES.certified;

  const cached = await getCachedTable();
  const row = cached.byArtist?.[id];

  // If artist not found, safe fallback
  if (!row) return MEDAL_STYLES.certified;

  // Global lock protection
  if (!cached.unlockStatus?.medalsUnlocked) return MEDAL_STYLES.certified;

  return row.medal || MEDAL_STYLES.certified;
}

export async function getMedalsForArtists(artistIds) {
  const ids = Array.isArray(artistIds) ? artistIds.map((x) => String(x || "").trim()).filter(Boolean) : [];
  const cached = await getCachedTable();

  const out = {};
  for (const id of ids) {
    const row = cached.byArtist?.[id];
    if (!row) {
      out[id] = MEDAL_STYLES.certified;
      continue;
    }
    out[id] = cached.unlockStatus?.medalsUnlocked ? (row.medal || MEDAL_STYLES.certified) : MEDAL_STYLES.certified;
  }

  return {
    medalsUnlocked: Boolean(cached.unlockStatus?.medalsUnlocked),
    unlockStatus: cached.unlockStatus,
    medalsByArtist: out,
  };
}

// -------------------- Routes --------------------
router.use(express.json({ limit: "64kb" }));

router.get("/health", async (_req, res) => {
  const cached = await getCachedTable();

  return res.json({
    success: true,
    service: SERVICE,
    version: VERSION,
    updatedAt: nowIso(),
    config: cached.meta?.config || null,
    sources: cached.meta?.sources || null,
    aggUpdatedAt: cached.meta?.aggUpdatedAt || null,
    unlockStatus: cached.unlockStatus || null,
  });
});

router.get("/unlock-status", async (_req, res) => {
  const cached = await getCachedTable();
  return res.json({
    success: true,
    updatedAt: nowIso(),
    unlockStatus: cached.unlockStatus,
    hint: "Until unlocked, everyone is Certified 🎸. Unlock is a platform milestone.",
  });
});

router.get("/artist/:artistId", async (req, res) => {
  const artistId = String(req.params.artistId || "").trim();
  if (!artistId) return res.status(400).json({ success: false, message: "artistId is required." });

  const cached = await getCachedTable();
  const row = cached.byArtist?.[artistId];

  if (!row) {
    return res.status(404).json({
      success: false,
      message: "No medal data for this artist (missing profile or not loaded).",
      artistId,
      unlockStatus: cached.unlockStatus,
    });
  }

  // If locked, always show certified publicly, but include explain
  const medal = cached.unlockStatus?.medalsUnlocked ? row.medal : MEDAL_STYLES.certified;

  return res.json({
    success: true,
    updatedAt: cached.meta?.aggUpdatedAt || nowIso(),
    artistId,
    score: row.score,
    rank: row.rank,
    total: row.total,
    percentile01: row.percentile01,
    medal,
    explain: {
      ...row.explain,
      locked: !cached.unlockStatus?.medalsUnlocked,
      lockReason: !cached.unlockStatus?.medalsUnlocked
        ? "Global medals are locked until minimum platform activity thresholds are met."
        : null,
      thresholds: {
        goldTopPct: GOLD_TOP_PCT,
        silverTopPct: SILVER_TOP_PCT,
        bronzeTopPct: BRONZE_TOP_PCT,
      },
    },
  });
});

router.get("/table", async (req, res) => {
  const limit = clamp(parseInt(req.query.limit || `${MAX_RETURN}`, 10) || MAX_RETURN, 1, MAX_RETURN);
  const cached = await getCachedTable();

  // When locked, table still returns ranks/scores but medals are all Certified (public truth)
  const locked = !cached.unlockStatus?.medalsUnlocked;

  const results = (cached.table || []).slice(0, limit).map((r) => ({
    artistId: r.artistId,
    rank: r.rank,
    total: r.total,
    percentile01: r.percentile01,
    score: r.score,
    lastAt: r.lastAt,
    medal: locked ? MEDAL_STYLES.certified : r.medal,
    artist: r.artist,
    lifetime: r.lifetime,
  }));

  return res.json({
    success: true,
    updatedAt: cached.meta?.aggUpdatedAt || nowIso(),
    medalsUnlocked: Boolean(cached.unlockStatus?.medalsUnlocked),
    unlockStatus: cached.unlockStatus,
    count: results.length,
    results,
  });
});

// Cache buster (admin/internal)
router.post("/_cache/reset", async (_req, res) => {
  resetCache();
  return res.json({ success: true, message: "Medals cache reset.", updatedAt: nowIso() });
});

export default router;