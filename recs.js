// recs.js
// iBand Backend — Recs Mix (v7 / Phase D medals integration)
// Root-level router: mounted at /api/recs
//
// Captain’s Protocol: full canonical, future-proof, Render-safe, always JSON.
//
// Phase D:
// - Attach medal info into every feed artist payload
// - Include medalsUnlocked + unlockStatus in /mix response
// - Uses named helper exports from medals.js (no duplication, no fragile import guesses)

import fs from "fs";
import path from "path";
import crypto from "crypto";
import express from "express";

import { getMedalsForArtists } from "./medals.js"; // ✅ Phase D integration

const router = express.Router();

// -------------------------
// Config (safe defaults)
// -------------------------
const SERVICE = "recs-mix";
const VERSION = 28; // Phase D medals integration (keep aligned with response you saw)

const DATA_DIR = process.env.IBAND_DATA_DIR || "/var/data/iband/db";
const EVENTS_AGG = process.env.IBAND_EVENTS_AGG || path.join(DATA_DIR, "events-agg.json");
const ARTISTS_FILE_CANON = path.join(DATA_DIR, "artists.json");
const EVENT_LOG = process.env.IBAND_EVENTS_LOG || path.join(DATA_DIR, "events.jsonl");

// Rotation state on disk (persistent)
const STATE_FILE = process.env.IBAND_RECS_STATE || path.join(DATA_DIR, "recs-state.json");

// Gentle explore tuning defaults
const DEFAULTS = {
  explorePct: 0.2,
  forceExploreMin: 1,
  injectSlots: [3],

  genreCap: 2,
  locationCap: 3,

  fatigueStep: 0.04,
  fatigueMin: 0.84,

  taste: {
    topK: 3,
    genreBoost: 2,
    locationBoost: 1,
    watchMsPerPoint: 5000,
  },

  coldStartBase: 1.5,
  coldStartTasteBoostMax: 3,

  exploreRotation: {
    cooldownMin: 60,
    historyMax: 20,
  },

  maxReturn: 50,
  tailKb: 512,
  maxLines: 2500,

  exploreExcludeIds: ["demo"],
};

// -------------------------
// Helpers
// -------------------------
function nowIso() {
  return new Date().toISOString();
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function readJsonIfExists(p) {
  try {
    if (!fs.existsSync(p)) return { ok: false, value: null, error: "ENOENT" };
    const raw = fs.readFileSync(p, "utf8");
    const val = safeJsonParse(raw, null);
    if (!val) return { ok: false, value: null, error: "EJSONPARSE" };
    return { ok: true, value: val, error: null };
  } catch (e) {
    return { ok: false, value: null, error: e?.message || "EREAD" };
  }
}

function writeJsonAtomic(p, obj) {
  const tmp = `${p}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, p);
}

function normalizeStr(s) {
  return String(s || "")
    .trim()
    .toLowerCase();
}

function normalizeGenre(genre) {
  const g = normalizeStr(genre);
  if (!g) return [];
  return g
    .split(/[\/,]/g)
    .map((x) => normalizeStr(x))
    .filter(Boolean);
}

function normalizeLocation(loc) {
  return normalizeStr(loc);
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

function pickInjectSlots(count, injectSlots) {
  const slots = (injectSlots || [])
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= count);

  if (count <= 12) return uniq(slots.length ? slots : [3]).slice(0, 2);
  return uniq(slots.length ? slots : [3, 8]).slice(0, 6);
}

function deriveExploreCount(feedCount, explorePct, forceExploreMin) {
  const pct = clamp(Number(explorePct ?? DEFAULTS.explorePct), 0, 1);
  const min = clamp(Number(forceExploreMin ?? DEFAULTS.forceExploreMin), 0, 10);

  const derived = Math.round(feedCount * pct);
  const capped = feedCount <= 12 ? clamp(derived, 0, 2) : derived;

  return Math.max(min, capped);
}

// --------- Wrapper-aware artists extraction ----------
function extractArtistsArray(parsed) {
  // Supported shapes:
  // 1) [ ...artists ]
  // 2) { "id1": {...}, "id2": {...} }  (keyed object)
  // 3) { success:true, artists:[...] }
  // 4) { data:[...] } / { items:[...] } / { results:[...] } / { list:[...] }
  // 5) { artists: { ...keyed... } }
  if (!parsed) return [];

  if (Array.isArray(parsed)) return parsed;

  if (parsed && typeof parsed === "object") {
    // common wrapper keys
    const candidates = ["artists", "data", "items", "results", "list"];
    for (const k of candidates) {
      const v = parsed[k];
      if (Array.isArray(v)) return v;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        // { artists: { id: {...} } }
        const maybeVals = Object.values(v).filter((x) => x && typeof x === "object");
        if (maybeVals.length) return maybeVals;
      }
    }

    // keyed object at top-level
    const vals = Object.values(parsed).filter((x) => x && typeof x === "object");
    // Guard: if this looks like a single artist object, not a map
    if (vals.length && !("id" in parsed && "name" in parsed)) {
      // many objects => likely keyed map
      if (vals.length > 1) return vals;
      // could still be map with 1 entry
      if (vals.length === 1 && typeof vals[0] === "object") return vals;
    }
  }

  return [];
}

function loadArtists() {
  const a = readJsonIfExists(ARTISTS_FILE_CANON);
  if (!a.ok) return { ok: false, artists: [], error: a.error, selected: { path: ARTISTS_FILE_CANON } };

  const rawArtists = extractArtistsArray(a.value);

  const normalized = rawArtists
    .map((x) => ({
      id: String(x?.id || "").trim(),
      name: x?.name ?? null,
      imageUrl: x?.imageUrl ?? null,
      genre: x?.genre ?? null,
      location: x?.location ?? null,
      bio: x?.bio ?? null,
      socials: x?.socials ?? null,
      tracks: Array.isArray(x?.tracks) ? x.tracks : [],
      status: x?.status ?? "active",
      createdAt: x?.createdAt ?? null,
      updatedAt: x?.updatedAt ?? null,
    }))
    .filter((x) => x.id);

  return { ok: true, artists: normalized, error: null, selected: { path: ARTISTS_FILE_CANON } };
}

function loadAgg() {
  const a = readJsonIfExists(EVENTS_AGG);
  if (!a.ok) return { ok: false, agg: null, error: a.error };
  return { ok: true, agg: a.value || null, error: null };
}

function tailLines(filePath, maxBytes, maxLines) {
  try {
    if (!fs.existsSync(filePath)) return { ok: false, lines: [], error: "ENOENT" };

    const stat = fs.statSync(filePath);
    const size = stat.size;
    const readSize = Math.min(size, maxBytes);

    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(readSize);
    fs.readSync(fd, buffer, 0, readSize, size - readSize);
    fs.closeSync(fd);

    const text = buffer.toString("utf8");
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    return { ok: true, lines: lines.slice(-maxLines), error: null };
  } catch (e) {
    return { ok: false, lines: [], error: e?.message || "ETAIL" };
  }
}

function parseEventsJsonlLines(lines) {
  const events = [];
  for (const ln of lines) {
    const obj = safeJsonParse(ln, null);
    if (obj && typeof obj === "object" && obj.type && obj.artistId) {
      events.push(obj);
    }
  }
  return events;
}

function buildSessionSignals(events, sessionId) {
  const sid = String(sessionId || "").trim();
  if (!sid) return { seen: 0, engagedPoints: 0, watchMs: 0, byArtist: {} };

  const byArtist = {};
  const typePts = { view: 1, replay: 2, like: 2, save: 3, share: 4, follow: 5, comment: 2, vote: 1 };

  let seen = 0;
  let engagedPoints = 0;
  let watchMs = 0;

  for (const ev of events) {
    if (String(ev.sessionId || "") !== sid) continue;

    const aid = String(ev.artistId || "");
    if (!aid) continue;

    const t = String(ev.type || "").toLowerCase();
    const pts = typePts[t] || 0;

    if (!byArtist[aid]) byArtist[aid] = { seen: 0, engagedPoints: 0, watchMs: 0, counts: {} };
    byArtist[aid].seen += 1;
    byArtist[aid].counts[t] = (byArtist[aid].counts[t] || 0) + 1;
    byArtist[aid].engagedPoints += pts;

    const wm = Number(ev.watchMs || 0);
    if (Number.isFinite(wm) && wm > 0) {
      byArtist[aid].watchMs += wm;
      watchMs += wm;
    }

    engagedPoints += pts;
    seen += 1;
  }

  return { seen, engagedPoints, watchMs, byArtist };
}

function buildTasteProfile(artistsById, signals, tasteCfg) {
  const topK = clamp(Number(tasteCfg?.topK ?? DEFAULTS.taste.topK), 1, 10);
  const watchMsPerPoint = clamp(Number(tasteCfg?.watchMsPerPoint ?? DEFAULTS.taste.watchMsPerPoint), 1000, 60000);

  const genreScore = {};
  const locScore = {};

  for (const [artistId, sig] of Object.entries(signals.byArtist || {})) {
    const a = artistsById[artistId];
    if (!a) continue;

    const ptsFromWatch = Math.floor((Number(sig.watchMs || 0) || 0) / watchMsPerPoint);
    const pts = (Number(sig.engagedPoints || 0) || 0) + ptsFromWatch;

    const genres = normalizeGenre(a.genre);
    const loc = normalizeLocation(a.location);

    for (const g of genres) genreScore[g] = (genreScore[g] || 0) + pts;
    if (loc) locScore[loc] = (locScore[loc] || 0) + pts;
  }

  const topGenres = Object.entries(genreScore)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([g]) => g);

  const topLocations = Object.entries(locScore)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([l]) => l);

  return { topGenres, topLocations };
}

function calcBaseScoreFromAgg(aggArtist, weights) {
  if (!aggArtist) return 0;
  const life = aggArtist?.lifetime || {};
  const w = weights || {};

  const sum =
    (Number(life.views || 0) || 0) * (Number(w.view || 1) || 1) +
    (Number(life.replays || 0) || 0) * (Number(w.replay || 2.5) || 2.5) +
    (Number(life.likes || 0) || 0) * (Number(w.like || 1.5) || 1.5) +
    (Number(life.saves || 0) || 0) * (Number(w.save || 3.5) || 3.5) +
    (Number(life.shares || 0) || 0) * (Number(w.share || 4.5) || 4.5) +
    (Number(life.follows || 0) || 0) * (Number(w.follow || 5) || 5) +
    (Number(life.comments || 0) || 0) * (Number(w.comment || 2) || 2) +
    (Number(life.votes || 0) || 0) * (Number(w.vote || 1) || 1);

  const watchMs = Number(life.watchMs || 0) || 0;
  const watchPoints = watchMs / 10000;

  return sum + watchPoints;
}

function freshnessMultiplier(lastAtIso, halfLifeHours) {
  if (!lastAtIso) return 0.9;
  const last = Date.parse(lastAtIso);
  if (!Number.isFinite(last)) return 0.9;

  const now = Date.now();
  const ageMs = Math.max(0, now - last);
  const ageHours = ageMs / (1000 * 60 * 60);
  const hl = clamp(Number(halfLifeHours || 24), 1, 168);

  return Math.pow(0.5, ageHours / hl);
}

function buildRankedList(artists, agg, cfg) {
  const weights = (cfg?.weights && typeof cfg.weights === "object") ? cfg.weights : {};
  const halfLifeHours = clamp(Number(cfg?.halfLifeHours ?? 24), 1, 168);

  // Support both possible shapes
  const aggArtists =
    (agg && agg.artists && typeof agg.artists === "object")
      ? agg.artists
      : {};

  const results = artists
    .filter((a) => a.status !== "deleted")
    .map((a) => {
      const aa = aggArtists[a.id] || null;
      const base = calcBaseScoreFromAgg(aa, weights);
      const fresh = freshnessMultiplier(aa?.lastAt, halfLifeHours);
      const score = base * fresh;

      const lifetime = aa?.lifetime || {
        views: 0, replays: 0, likes: 0, saves: 0, shares: 0, follows: 0, comments: 0, votes: 0, watchMs: 0,
      };

      return {
        artistId: a.id,
        baseScore: Number.isFinite(base) ? base : 0,
        score: Number.isFinite(score) ? score : 0,
        lastAt: aa?.lastAt || null,
        metrics: {
          views: Number(lifetime.views || 0) || 0,
          replays: Number(lifetime.replays || 0) || 0,
          likes: Number(lifetime.likes || 0) || 0,
          saves: Number(lifetime.saves || 0) || 0,
          shares: Number(lifetime.shares || 0) || 0,
          follows: Number(lifetime.follows || 0) || 0,
          comments: Number(lifetime.comments || 0) || 0,
          votes: Number(lifetime.votes || 0) || 0,
          watchMs: Number(lifetime.watchMs || 0) || 0,
        },
        artist: { id: a.id, name: a.name, imageUrl: a.imageUrl, genre: a.genre, location: a.location },
      };
    })
    .sort((x, y) => y.score - x.score);

  return results;
}

function loadState() {
  const st = readJsonIfExists(STATE_FILE);
  if (!st.ok) return { ok: true, state: { v: 1, updatedAt: null, sessions: {} }, created: true };
  const s = st.value && typeof st.value === "object" ? st.value : { v: 1, sessions: {} };
  if (!s.sessions || typeof s.sessions !== "object") s.sessions = {};
  return { ok: true, state: s, created: false };
}

function getSessionExploreHistory(state, sessionId) {
  const sid = String(sessionId || "").trim() || "_anon";
  if (!state.sessions[sid]) state.sessions[sid] = { explore: [], updatedAt: null };
  if (!Array.isArray(state.sessions[sid].explore)) state.sessions[sid].explore = [];
  return { sid, hist: state.sessions[sid].explore };
}

function pruneExploreHistory(hist, cooldownMin, historyMax) {
  const now = Date.now();
  const cooldownMs = clamp(Number(cooldownMin || DEFAULTS.exploreRotation.cooldownMin), 1, 1440) * 60 * 1000;

  const kept = (hist || [])
    .filter((x) => x && x.id && x.at)
    .filter((x) => {
      const t = Date.parse(x.at);
      if (!Number.isFinite(t)) return false;
      return now - t <= cooldownMs;
    });

  const max = clamp(Number(historyMax || DEFAULTS.exploreRotation.historyMax), 1, 200);
  return kept.slice(-max);
}

function recordExplorePick(state, sessionId, artistId) {
  const { sid, hist } = getSessionExploreHistory(state, sessionId);
  const next = Array.isArray(hist) ? hist : [];
  next.push({ id: artistId, at: nowIso() });
  state.sessions[sid].explore = next;
  state.sessions[sid].updatedAt = nowIso();
  state.updatedAt = nowIso();
}

function computeFatigueMultiplier(signalsByArtist, fatigueStep, fatigueMin, artistId) {
  const seen = Number(signalsByArtist?.[artistId]?.seen || 0) || 0;
  const step = clamp(Number(fatigueStep ?? DEFAULTS.fatigueStep), 0, 0.25);
  const min = clamp(Number(fatigueMin ?? DEFAULTS.fatigueMin), 0.5, 1);
  const mult = 1 - seen * step;
  return clamp(mult, min, 1);
}

function tasteBoostForArtist(taste, artist, tasteCfg) {
  const genreBoost = clamp(Number(tasteCfg?.genreBoost ?? DEFAULTS.taste.genreBoost), 0, 10);
  const locationBoost = clamp(Number(tasteCfg?.locationBoost ?? DEFAULTS.taste.locationBoost), 0, 10);

  const gTokens = normalizeGenre(artist?.genre);
  const loc = normalizeLocation(artist?.location);

  let boost = 0;
  for (const tg of taste.topGenres || []) if (gTokens.includes(normalizeStr(tg))) boost += genreBoost;
  for (const tl of taste.topLocations || []) if (loc && loc === normalizeStr(tl)) boost += locationBoost;

  return boost;
}

function isColdStart(aggArtists, artistId) {
  const aa = aggArtists?.[artistId] || null;
  if (!aa) return true;
  const life = aa.lifetime || {};
  const total =
    (Number(life.views || 0) || 0) +
    (Number(life.replays || 0) || 0) +
    (Number(life.likes || 0) || 0) +
    (Number(life.saves || 0) || 0) +
    (Number(life.shares || 0) || 0) +
    (Number(life.follows || 0) || 0) +
    (Number(life.comments || 0) || 0) +
    (Number(life.votes || 0) || 0) +
    (Number(life.watchMs || 0) || 0);
  return total === 0;
}

function chooseExploreCandidates({ allArtists, ranked, aggArtists, taste, cfg, alreadyChosenIds, prunedHistory }) {
  const excludeIds = uniq([...(cfg.exploreExcludeIds || DEFAULTS.exploreExcludeIds || [])].map(String));
  const recently = new Set((prunedHistory || []).map((x) => x.id));

  const tasteCfg = cfg.taste || DEFAULTS.taste;

  const pool = allArtists
    .filter((a) => a && a.id)
    .filter((a) => !excludeIds.includes(a.id))
    .filter((a) => !alreadyChosenIds.has(a.id))
    .filter((a) => a.status !== "deleted");

  const scored = pool.map((a) => {
    const cold = isColdStart(aggArtists, a.id);
    const tBoost = tasteBoostForArtist(taste, a, tasteCfg);
    const tasteMatch = tBoost > 0;

    const base = cold ? Number(cfg.coldStartBase ?? DEFAULTS.coldStartBase) : 0;
    const maxTasteBoost = clamp(Number(cfg.coldStartTasteBoostMax ?? DEFAULTS.coldStartTasteBoostMax), 0, 10);
    const coldTasteBoost = cold ? clamp(tBoost, 0, maxTasteBoost) : 0;

    const recentPenalty = recently.has(a.id) ? -9999 : 0;
    const rankedEntry = ranked.find((r) => r.artistId === a.id);
    const rankedScore = rankedEntry ? rankedEntry.score : 0;

    const score =
      recentPenalty +
      (cold ? 1000 : 0) +
      (tasteMatch ? 100 : 0) +
      coldTasteBoost * 10 +
      base * 3 +
      Math.log10(1 + Math.max(0, rankedScore));

    return { artist: a, exploreScore: score, coldStart: cold, tasteBoost: tBoost, recentlyShown: recently.has(a.id) };
  });

  scored.sort((x, y) => y.exploreScore - x.exploreScore);
  return scored;
}

function applyCaps(list, genreCap, locationCap) {
  const gCap = clamp(Number(genreCap ?? DEFAULTS.genreCap), 1, 10);
  const lCap = clamp(Number(locationCap ?? DEFAULTS.locationCap), 1, 20);

  const gCount = {};
  const lCount = {};

  const kept = [];
  const rejected = [];

  for (const item of list) {
    const gTokens = normalizeGenre(item?.artist?.genre);
    const loc = normalizeLocation(item?.artist?.location);

    const gKey = gTokens.length ? gTokens[0] : "";
    const lKey = loc || "";

    const gOk = !gKey || (gCount[gKey] || 0) < gCap;
    const lOk = !lKey || (lCount[lKey] || 0) < lCap;

    if (gOk && lOk) {
      kept.push(item);
      if (gKey) gCount[gKey] = (gCount[gKey] || 0) + 1;
      if (lKey) lCount[lKey] = (lCount[lKey] || 0) + 1;
    } else {
      rejected.push(item);
    }
  }

  return { kept, rejected };
}

// -------------------------
// Health endpoint
// -------------------------
router.get("/health", async (_req, res) => {
  const artists = loadArtists();
  const agg = loadAgg();
  const st = readJsonIfExists(STATE_FILE);
  const artistsRaw = readJsonIfExists(ARTISTS_FILE_CANON);

  // Phase D: expose medals status snapshot (safe best-effort)
  let medalsUnlocked = false;
  let unlockStatus = null;
  try {
    const m = await getMedalsForArtists((artists.ok ? artists.artists : []).map((a) => a.id));
    medalsUnlocked = !!m.medalsUnlocked;
    unlockStatus = m.unlockStatus || null;
  } catch {
    // best-effort, keep health stable
  }

  res.json({
    success: true,
    service: SERVICE,
    version: VERSION,
    updatedAt: nowIso(),
    sources: {
      dataDir: DATA_DIR,
      eventsAgg: EVENTS_AGG,
      artistsFile: ARTISTS_FILE_CANON,
      eventLog: EVENT_LOG,
      stateFile: STATE_FILE,
      stateFileOk: st.ok,
      artistsFileOk: artistsRaw.ok,
      artistsFileTopKeys:
        artistsRaw.ok && artistsRaw.value && typeof artistsRaw.value === "object" && !Array.isArray(artistsRaw.value)
          ? Object.keys(artistsRaw.value).slice(0, 10)
          : Array.isArray(artistsRaw.value)
            ? ["<array>"]
            : null,
    },
    artistsLoaded: artists.ok ? artists.artists.length : 0,
    aggOk: agg.ok,
    medals: {
      integrated: true,
      medalsUnlocked,
      unlockStatus,
    },
    configDefaults: {
      explorePct: DEFAULTS.explorePct,
      forceExploreMin: DEFAULTS.forceExploreMin,
      injectSlots: DEFAULTS.injectSlots,
      genreCap: DEFAULTS.genreCap,
      locationCap: DEFAULTS.locationCap,
      fatigueStep: DEFAULTS.fatigueStep,
      fatigueMin: DEFAULTS.fatigueMin,
      taste: DEFAULTS.taste,
      coldStartBase: DEFAULTS.coldStartBase,
      exploreRotation: DEFAULTS.exploreRotation,
      exploreExcludeIds: DEFAULTS.exploreExcludeIds,
    },
  });
});

// -------------------------
// Main endpoint: /mix
// -------------------------
router.get("/mix", async (req, res) => {
  const sessionId = String(req.query.sessionId || "").trim() || "anon";
  const maxReturn = clamp(Number(req.query.maxReturn || DEFAULTS.maxReturn), 1, DEFAULTS.maxReturn);

  const artistsLoad = loadArtists();
  if (!artistsLoad.ok) {
    return res.status(500).json({
      success: false,
      message: "Artists file not available.",
      error: artistsLoad.error,
      updatedAt: nowIso(),
    });
  }

  const aggLoad = loadAgg();
  const agg = aggLoad.ok ? aggLoad.agg : null;

  // Support both shapes:
  const aggArtists =
    (agg && agg.artists && typeof agg.artists === "object")
      ? agg.artists
      : {};

  const feedCount = Math.min(artistsLoad.artists.length, maxReturn);

  const rankedRaw = buildRankedList(artistsLoad.artists, agg, {
    halfLifeHours: 24,
    weights: { view: 1, replay: 2.5, like: 1.5, save: 3.5, share: 4.5, follow: 5, comment: 2, vote: 1 },
  });

  const maxBytes = clamp(Number(DEFAULTS.tailKb), 16, 4096) * 1024;
  const tail = tailLines(EVENT_LOG, maxBytes, clamp(Number(DEFAULTS.maxLines), 100, 20000));
  const events = tail.ok ? parseEventsJsonlLines(tail.lines) : [];
  const signals = buildSessionSignals(events, sessionId);

  const artistsById = {};
  for (const a of artistsLoad.artists) artistsById[a.id] = a;
  const taste = buildTasteProfile(artistsById, signals, DEFAULTS.taste);

  const cfg = {
    explorePct: DEFAULTS.explorePct,
    genreCap: DEFAULTS.genreCap,
    locationCap: DEFAULTS.locationCap,
    fatigueStep: DEFAULTS.fatigueStep,
    fatigueMin: DEFAULTS.fatigueMin,
    exploreNudge: 1.02,
    forceExploreMin: DEFAULTS.forceExploreMin,
    coldStartBase: DEFAULTS.coldStartBase,
    coldStartTasteBoostMax: DEFAULTS.coldStartTasteBoostMax,
    taste: DEFAULTS.taste,
    exploreRotation: DEFAULTS.exploreRotation,
    exploreExcludeIds: DEFAULTS.exploreExcludeIds,
  };

  const injectSlots = pickInjectSlots(feedCount, DEFAULTS.injectSlots);
  const exploreCount = deriveExploreCount(feedCount, cfg.explorePct, cfg.forceExploreMin);

  const enrichedRanked = rankedRaw.map((r) => {
    const aid = r.artistId;
    const sig = signals.byArtist?.[aid] || null;

    const engaged = Number(sig?.engagedPoints || 0) || 0;
    const watchMs = Number(sig?.watchMs || 0) || 0;

    const personalization = 1 + engaged / 30 + watchMs / 120000;
    const fatigue = computeFatigueMultiplier(signals.byArtist, cfg.fatigueStep, cfg.fatigueMin, aid);

    return {
      ...r,
      multipliers: { personalization: Number(personalization.toFixed(6)), fatigue: Number(fatigue.toFixed(6)) },
      score: r.score * personalization * fatigue,
      source: "ranked",
      explain: {
        sessionId,
        seen: Number(sig?.seen || 0) || 0,
        engagedPoints: engaged,
        watchMs,
        lastAt: r.lastAt,
      },
    };
  });

  enrichedRanked.sort((a, b) => b.score - a.score);

  const capped = applyCaps(enrichedRanked, cfg.genreCap, cfg.locationCap);
  let baseList = capped.kept.slice(0, feedCount);

  if (baseList.length < feedCount) {
    const needed = feedCount - baseList.length;
    baseList = baseList.concat(capped.rejected.slice(0, needed));
  }

  const chosen = new Set(baseList.map((x) => x.artistId));

  const stLoad = loadState();
  const state = stLoad.state;
  const { sid, hist } = getSessionExploreHistory(state, sessionId);
  const pruned = pruneExploreHistory(hist, cfg.exploreRotation.cooldownMin, cfg.exploreRotation.historyMax);
  state.sessions[sid].explore = pruned;

  const exploreScored = chooseExploreCandidates({
    allArtists: artistsLoad.artists,
    ranked: enrichedRanked,
    aggArtists,
    taste,
    cfg,
    alreadyChosenIds: chosen,
    prunedHistory: pruned,
  });

  const injections = [];
  const maxExploreToInject = Math.min(exploreCount, injectSlots.length ? injectSlots.length : 1);

  for (let i = 0; i < maxExploreToInject; i++) {
    const cand = exploreScored[i];
    if (!cand || !cand.artist || !cand.artist.id) continue;

    const a = cand.artist;
    const base = cand.coldStart ? Number(cfg.coldStartBase) : 0;
    const tBoost = clamp(Number(cand.tasteBoost || 0), 0, Number(cfg.coldStartTasteBoostMax || 3));
    const computedBase = cand.coldStart ? base * Math.max(1, tBoost) : base;

    injections.push({
      artistId: a.id,
      artist: { id: a.id, name: a.name, imageUrl: a.imageUrl, genre: a.genre, location: a.location },
      baseScore: Number((cand.coldStart ? computedBase : 0).toFixed(6)),
      score: Number((cand.coldStart ? computedBase : 0).toFixed(6)),
      lastAt: null,
      metrics: { views: 0, replays: 0, likes: 0, saves: 0, shares: 0, follows: 0, comments: 0, votes: 0, watchMs: 0 },
      source: cand.coldStart ? "explore" : "explore-relaxed",
      explain: {
        sessionId,
        explore: true,
        taste,
        rotation: { cooldownMin: cfg.exploreRotation.cooldownMin, recentExploreCount: pruned.length },
        coldStart: cand.coldStart
          ? { applied: true, base: cfg.coldStartBase, tasteBoost: tBoost, computedBase: Number(computedBase.toFixed(6)) }
          : null,
      },
    });

    chosen.add(a.id);
    recordExplorePick(state, sessionId, a.id);
  }

  try {
    writeJsonAtomic(STATE_FILE, state);
  } catch {
    // best effort
  }

  let final = [...baseList];

  for (let i = 0; i < injections.length; i++) {
    const slot = injectSlots[i] || injectSlots[0] || 3;
    const idx = clamp(slot - 1, 0, Math.max(0, final.length - 1));
    final.splice(idx, 1, injections[i]);
  }

  if (final.length < feedCount) {
    const need = feedCount - final.length;
    const leftovers = enrichedRanked.filter((x) => !final.some((y) => y.artistId === x.artistId));
    final = final.concat(leftovers.slice(0, need));
  }

  // Fill should be rare; only if absolutely unavoidable
  if (final.length < feedCount) {
    const need = feedCount - final.length;
    const remaining = artistsLoad.artists
      .filter((a) => a && a.id)
      .filter((a) => !final.some((y) => y.artistId === a.id))
      .slice(0, need)
      .map((a) => ({
        artistId: a.id,
        artist: { id: a.id, name: a.name, imageUrl: a.imageUrl, genre: a.genre, location: a.location },
        baseScore: 0,
        score: 0,
        lastAt: null,
        metrics: { views: 0, replays: 0, likes: 0, saves: 0, shares: 0, follows: 0, comments: 0, votes: 0, watchMs: 0 },
        source: "fill",
        explain: { sessionId, filler: true },
      }));

    final = final.concat(remaining);
  }

  final = final.slice(0, feedCount);

  // -------------------------
  // Phase D: Medal integration
  // -------------------------
  let medalsUnlocked = false;
  let unlockStatus = null;
  let medalsByArtistId = {};

  try {
    const medalRes = await getMedalsForArtists(final.map((x) => x.artistId));
    medalsUnlocked = !!medalRes.medalsUnlocked;
    unlockStatus = medalRes.unlockStatus || null;
    medalsByArtistId = medalRes.medalsByArtistId || {};
  } catch {
    // best effort: never break feed
    medalsUnlocked = false;
    unlockStatus = null;
    medalsByArtistId = {};
  }

  return res.json({
    success: true,
    version: VERSION,
    updatedAt: agg?.updatedAt || nowIso(),
    sessionId,

    medalsUnlocked,
    unlockStatus,

    count: final.length,
    results: final.map((x) => {
      const medal = medalsByArtistId?.[x.artistId] || null;

      return {
        artist: {
          ...x.artist,
          medal: medal || undefined,
        },
        score: Number((x.score ?? 0).toFixed(6)),
        metrics: x.metrics || {},
        source: x.source || "ranked",
      };
    }),
  });
});

export default router;