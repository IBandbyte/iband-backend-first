/**
 * votes.js (root) — ESM default export
 * iBand Votes Service (v3.0 + Phase D)
 *
 * Phase D:
 * - Adds GET /api/votes/status?sessionId=...&artistId=...(&category=...)
 *   Returns server-truth countdowns for:
 *   - Undo remaining (5 min default)
 *   - Artist vote lock remaining (24h default)
 *   - Category cap remaining (optional)
 *
 * Also includes (canonical, future-proof):
 * - POST /api/votes  (cast vote)
 * - POST /api/votes/undo (undo within window)
 * - GET  /api/votes/health
 *
 * Persistence:
 * - DATA_DIR/votes.jsonl      (append-only vote log)
 * - DATA_DIR/votes-state.json (fast lookup state)
 * - DATA_DIR/events.jsonl     (shared event bus for ranking/recs; logs type:"vote")
 */

import express from "express";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const router = express.Router();

// -------------------- Env / Paths --------------------
const DATA_DIR = process.env.DATA_DIR || "/var/data/iband/db";

const VOTES_LOG_FILE =
  process.env.VOTES_LOG_FILE || path.join(DATA_DIR, "votes.jsonl");
const VOTES_STATE_FILE =
  process.env.VOTES_STATE_FILE || path.join(DATA_DIR, "votes-state.json");

// shared algorithm event bus (ranking reads this)
const EVENTS_LOG_FILE =
  process.env.EVENTS_LOG_FILE || path.join(DATA_DIR, "events.jsonl");

// rate limiting (per session)
const RATE_WINDOW_SEC = parseInt(process.env.VOTES_RATE_WINDOW_SEC || "3600", 10);
const MAX_VOTES_PER_WINDOW = parseInt(process.env.VOTES_MAX_PER_WINDOW || "30", 10);

// per-artist cooldown (short cooldown, e.g. 5 min)
const ARTIST_COOLDOWN_SEC = parseInt(process.env.VOTES_ARTIST_COOLDOWN_SEC || "300", 10);

// per-artist lock (strategic competition, e.g. 24h)
const ARTIST_LOCK_HOURS = parseFloat(process.env.VOTES_ARTIST_LOCK_HOURS || "24");

// undo window (accidental vote grace)
const UNDO_WINDOW_SEC = parseInt(process.env.VOTES_UNDO_WINDOW_SEC || "300", 10);

// allow downvotes
const ALLOW_DOWNVOTE = String(process.env.VOTES_ALLOW_DOWNVOTE || "true").toLowerCase() === "true";

// category caps (Phase B-ready)
const CATEGORY_WINDOW_HOURS = parseFloat(process.env.VOTES_CATEGORY_WINDOW_HOURS || "24");
const CATEGORY_CAP = parseInt(process.env.VOTES_CATEGORY_CAP || "3", 10);

// request body limit
const MAX_BODY_KB = parseInt(process.env.VOTES_MAX_BODY_KB || "32", 10);

const routerVersion = 4; // service version (bump whenever behavior changes)

// -------------------- Utilities --------------------
function nowIso() {
  return new Date().toISOString();
}
function nowMs() {
  return Date.now();
}
function safeNumber(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function normalizeId(x) {
  return String(x || "").trim();
}
function normalizeCategory(x) {
  const s = String(x || "").trim();
  return s ? s.toLowerCase() : null;
}
function makeId(prefix = "evt") {
  return `${prefix}_${nowMs()}_${crypto.randomBytes(8).toString("hex")}`;
}
function msFromHours(h) {
  return safeNumber(h, 0) * 60 * 60 * 1000;
}
function msFromSec(s) {
  return safeNumber(s, 0) * 1000;
}
function parseIsoMs(iso) {
  const t = Date.parse(String(iso || ""));
  return Number.isFinite(t) ? t : null;
}
function secondsRemaining(untilMs) {
  const rem = Math.ceil((untilMs - nowMs()) / 1000);
  return rem > 0 ? rem : 0;
}

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // ignore
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

async function writeJsonAtomic(filePath, obj) {
  const tmp = `${filePath}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`;
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

async function appendJsonl(filePath, obj) {
  const line = JSON.stringify(obj);
  await fs.appendFile(filePath, `${line}\n`, "utf8");
}

async function statOk(p) {
  try {
    const s = await fs.stat(p);
    return { ok: true, size: s.size, mtimeMs: s.mtimeMs };
  } catch (e) {
    return { ok: false, error: e?.code || String(e) };
  }
}

// -------------------- State Model --------------------
/**
 * votes-state.json schema (v1)
 * {
 *   "version": 1,
 *   "updatedAt": "...",
 *   "sessions": {
 *     "<sessionId>": {
 *       "rate": { "windowStartMs": 0, "count": 0 },
 *       "artists": {
 *          "<artistId>": {
 *             "lastVoteMs": 0,
 *             "lockUntilMs": 0,
 *             "lastVoteEventId": "...",   // most recent vote event (for undo)
 *             "lastDelta": 1,
 *             "undoUntilMs": 0,
 *             "lastCategory": "music"
 *          }
 *       },
 *       "categories": {
 *          "<categoryKey>": { "windowStartMs": 0, "count": 0 }
 *       }
 *     }
 *   }
 * }
 */
const STATE_BASE = {
  version: 1,
  updatedAt: null,
  sessions: {},
};

async function loadState() {
  const st = await readJsonSafe(VOTES_STATE_FILE, STATE_BASE);
  if (!st || typeof st !== "object") return { ...STATE_BASE };
  if (!st.sessions || typeof st.sessions !== "object") st.sessions = {};
  return st;
}

function getSessionState(state, sessionId) {
  if (!state.sessions[sessionId]) {
    state.sessions[sessionId] = {
      rate: { windowStartMs: 0, count: 0 },
      artists: {},
      categories: {},
    };
  }
  return state.sessions[sessionId];
}

function getArtistState(sess, artistId) {
  if (!sess.artists[artistId]) {
    sess.artists[artistId] = {
      lastVoteMs: 0,
      lockUntilMs: 0,
      lastVoteEventId: null,
      lastDelta: 0,
      undoUntilMs: 0,
      lastCategory: null,
    };
  }
  return sess.artists[artistId];
}

function getCategoryState(sess, categoryKey) {
  if (!sess.categories[categoryKey]) {
    sess.categories[categoryKey] = { windowStartMs: 0, count: 0 };
  }
  return sess.categories[categoryKey];
}

function bumpWindowCounter(counter, windowMs) {
  const t = nowMs();
  const start = safeNumber(counter.windowStartMs, 0);
  if (!start || t - start >= windowMs) {
    counter.windowStartMs = t;
    counter.count = 0;
  }
  counter.count = safeNumber(counter.count, 0) + 1;
  return counter;
}

function peekWindowCounter(counter, windowMs) {
  const t = nowMs();
  const start = safeNumber(counter.windowStartMs, 0);
  if (!start || t - start >= windowMs) {
    return { windowStartMs: t, count: 0, reset: true };
  }
  return { windowStartMs: start, count: safeNumber(counter.count, 0), reset: false };
}

// -------------------- Core Rules --------------------
function computeArtistLockUntilMs() {
  return nowMs() + msFromHours(ARTIST_LOCK_HOURS);
}

function computeUndoUntilMs() {
  return nowMs() + msFromSec(UNDO_WINDOW_SEC);
}

function allowDelta(delta) {
  if (delta === 1) return true;
  if (delta === -1) return ALLOW_DOWNVOTE;
  return false;
}

// -------------------- Router Setup --------------------
router.use(express.json({ limit: `${MAX_BODY_KB}kb` }));

// -------------------- Health --------------------
router.get("/health", async (_req, res) => {
  await ensureDir(DATA_DIR);

  return res.json({
    success: true,
    service: "votes",
    version: routerVersion,
    dataDir: DATA_DIR,
    updatedAt: nowIso(),
    limits: {
      rateWindowSec: RATE_WINDOW_SEC,
      maxVotesPerWindow: MAX_VOTES_PER_WINDOW,
      artistCooldownSec: ARTIST_COOLDOWN_SEC,
      artistLockHours: ARTIST_LOCK_HOURS,
      undoWindowSec: UNDO_WINDOW_SEC,
      allowDownvote: ALLOW_DOWNVOTE,
      categoryWindowHours: CATEGORY_WINDOW_HOURS,
      categoryCap: CATEGORY_CAP,
    },
    files: {
      votesLog: { path: VOTES_LOG_FILE, stat: await statOk(VOTES_LOG_FILE) },
      votesState: { path: VOTES_STATE_FILE, stat: await statOk(VOTES_STATE_FILE) },
      eventsLog: { path: EVENTS_LOG_FILE, stat: await statOk(EVENTS_LOG_FILE) },
    },
  });
});

// -------------------- Phase D: Status (countdowns) --------------------
router.get("/status", async (req, res) => {
  const sessionId = normalizeId(req.query.sessionId);
  const artistId = normalizeId(req.query.artistId);
  const category = normalizeCategory(req.query.category);

  if (!sessionId) {
    return res.status(400).json({ success: false, message: "sessionId is required." });
  }
  if (!artistId) {
    return res.status(400).json({ success: false, message: "artistId is required." });
  }

  const state = await loadState();
  const sess = getSessionState(state, sessionId);
  const a = getArtistState(sess, artistId);

  // Artist cooldown (short)
  const cooldownUntilMs = safeNumber(a.lastVoteMs, 0) + msFromSec(ARTIST_COOLDOWN_SEC);
  const cooldownRemainingSec = secondsRemaining(cooldownUntilMs);

  // Artist lock (24h competition)
  const lockUntilMs = safeNumber(a.lockUntilMs, 0);
  const voteAgainInSec = secondsRemaining(lockUntilMs);

  // Undo window
  const undoUntilMs = safeNumber(a.undoUntilMs, 0);
  const undoRemainingSec = secondsRemaining(undoUntilMs);

  // Rate window
  const rateWindowMs = msFromSec(RATE_WINDOW_SEC);
  const ratePeek = peekWindowCounter(sess.rate, rateWindowMs);
  const rateRemaining = Math.max(0, MAX_VOTES_PER_WINDOW - ratePeek.count);

  // Category cap (optional)
  let categoryCap = null;
  if (category) {
    const catWindowMs = msFromHours(CATEGORY_WINDOW_HOURS);
    const cat = getCategoryState(sess, category);
    const catPeek = peekWindowCounter(cat, catWindowMs);
    categoryCap = {
      category,
      cap: CATEGORY_CAP,
      used: catPeek.count,
      remaining: Math.max(0, CATEGORY_CAP - catPeek.count),
      windowHours: CATEGORY_WINDOW_HOURS,
      windowResetInSec: secondsRemaining(catPeek.windowStartMs + catWindowMs),
    };
  }

  const canUndo = undoRemainingSec > 0 && !!a.lastVoteEventId;
  const canVote =
    cooldownRemainingSec === 0 &&
    voteAgainInSec === 0 &&
    rateRemaining > 0 &&
    (!categoryCap || categoryCap.remaining > 0);

  let reason = "ok";
  if (!canVote) {
    if (cooldownRemainingSec > 0) reason = "artist_cooldown";
    else if (voteAgainInSec > 0) reason = "artist_lock";
    else if (rateRemaining <= 0) reason = "rate_limit";
    else if (categoryCap && categoryCap.remaining <= 0) reason = "category_cap";
    else reason = "not_allowed";
  }

  return res.json({
    success: true,
    updatedAt: nowIso(),
    sessionId,
    artistId,
    category: category || null,

    canVote,
    reason,

    canUndo,
    undoRemainingSec,

    artistCooldownRemainingSec: cooldownRemainingSec,
    voteAgainInSec,

    rate: {
      windowSec: RATE_WINDOW_SEC,
      max: MAX_VOTES_PER_WINDOW,
      used: ratePeek.count,
      remaining: rateRemaining,
      resetInSec: secondsRemaining(ratePeek.windowStartMs + rateWindowMs),
    },

    categoryCap,
  });
});

// -------------------- Cast Vote --------------------
router.post("/", async (req, res) => {
  await ensureDir(DATA_DIR);

  const artistId = normalizeId(req.body?.artistId);
  const sessionId = normalizeId(req.body?.sessionId);
  const category = normalizeCategory(req.body?.category);

  // delta defaults to +1
  const delta = Number(req.body?.delta ?? 1);

  if (!artistId) return res.status(400).json({ success: false, message: "artistId is required." });
  if (!sessionId) return res.status(400).json({ success: false, message: "sessionId is required." });
  if (!allowDelta(delta)) {
    return res.status(400).json({ success: false, message: "Invalid delta." });
  }

  const state = await loadState();
  const sess = getSessionState(state, sessionId);
  const a = getArtistState(sess, artistId);

  // rate limit per session (global)
  const rateWindowMs = msFromSec(RATE_WINDOW_SEC);
  const rate = bumpWindowCounter(sess.rate, rateWindowMs);
  if (rate.count > MAX_VOTES_PER_WINDOW) {
    // revert bump
    rate.count -= 1;
    state.updatedAt = nowIso();
    await writeJsonAtomic(VOTES_STATE_FILE, state);
    return res.status(429).json({
      success: false,
      message: "Too many requests (vote rate limit).",
      limits: { rateWindowSec: RATE_WINDOW_SEC, maxVotesPerWindow: MAX_VOTES_PER_WINDOW },
    });
  }

  // category cap (optional)
  if (category) {
    const catWindowMs = msFromHours(CATEGORY_WINDOW_HOURS);
    const cat = bumpWindowCounter(getCategoryState(sess, category), catWindowMs);
    if (cat.count > CATEGORY_CAP) {
      // revert bumps
      cat.count -= 1;
      rate.count -= 1;
      state.updatedAt = nowIso();
      await writeJsonAtomic(VOTES_STATE_FILE, state);
      return res.status(429).json({
        success: false,
        message: "Category vote cap reached.",
        category,
        cap: CATEGORY_CAP,
        windowHours: CATEGORY_WINDOW_HOURS,
      });
    }
  }

  // artist short cooldown
  const lastVoteMs = safeNumber(a.lastVoteMs, 0);
  const cooldownUntilMs = lastVoteMs + msFromSec(ARTIST_COOLDOWN_SEC);
  if (lastVoteMs && nowMs() < cooldownUntilMs) {
    // revert bumps
    rate.count -= 1;
    if (category) {
      const cat = getCategoryState(sess, category);
      cat.count = Math.max(0, safeNumber(cat.count, 1) - 1);
    }
    state.updatedAt = nowIso();
    await writeJsonAtomic(VOTES_STATE_FILE, state);
    return res.status(429).json({
      success: false,
      message: "Artist cooldown active.",
      artistId,
      retryInSec: secondsRemaining(cooldownUntilMs),
    });
  }

  // artist lock (24h competition)
  const lockUntilMs = safeNumber(a.lockUntilMs, 0);
  if (lockUntilMs && nowMs() < lockUntilMs) {
    // revert bumps
    rate.count -= 1;
    if (category) {
      const cat = getCategoryState(sess, category);
      cat.count = Math.max(0, safeNumber(cat.count, 1) - 1);
    }
    state.updatedAt = nowIso();
    await writeJsonAtomic(VOTES_STATE_FILE, state);
    return res.status(409).json({
      success: false,
      message: "Vote locked for this artist (cooldown window).",
      artistId,
      voteAgainInSec: secondsRemaining(lockUntilMs),
    });
  }

  // record vote event
  const voteEvent = {
    id: makeId("evt"),
    at: nowIso(),
    type: "vote",
    artistId,
    sessionId,
    watchMs: 0,
    v: 1,
    delta,
    category: category || null,
  };

  // state updates (for status/undo)
  a.lastVoteMs = nowMs();
  a.lockUntilMs = computeArtistLockUntilMs();
  a.lastVoteEventId = voteEvent.id;
  a.lastDelta = delta;
  a.undoUntilMs = computeUndoUntilMs();
  a.lastCategory = category || a.lastCategory || null;

  state.updatedAt = nowIso();

  // persist
  await appendJsonl(VOTES_LOG_FILE, voteEvent);
  await appendJsonl(EVENTS_LOG_FILE, voteEvent); // ranking/recs read this
  await writeJsonAtomic(VOTES_STATE_FILE, state);

  return res.json({
    success: true,
    message: "Vote recorded.",
    voteEvent,
    updatedAt: state.updatedAt,
    limits: {
      artistLockHours: ARTIST_LOCK_HOURS,
      undoWindowSec: UNDO_WINDOW_SEC,
    },
  });
});

// -------------------- Undo Vote --------------------
router.post("/undo", async (req, res) => {
  await ensureDir(DATA_DIR);

  const sessionId = normalizeId(req.body?.sessionId);
  const artistId = normalizeId(req.body?.artistId);

  if (!sessionId) return res.status(400).json({ success: false, message: "sessionId is required." });
  if (!artistId) return res.status(400).json({ success: false, message: "artistId is required." });

  const state = await loadState();
  const sess = getSessionState(state, sessionId);
  const a = getArtistState(sess, artistId);

  const undoUntilMs = safeNumber(a.undoUntilMs, 0);
  const lastVoteEventId = a.lastVoteEventId;

  if (!lastVoteEventId) {
    return res.status(409).json({ success: false, message: "No vote to undo for this artist." });
  }

  if (!undoUntilMs || nowMs() > undoUntilMs) {
    return res.status(409).json({
      success: false,
      message: "Undo window expired.",
      undoRemainingSec: 0,
    });
  }

  // create an "undo vote" event (delta inverse)
  const undoDelta = a.lastDelta === 0 ? -1 : -a.lastDelta;

  // If downvotes are disabled and undo would be +1/-1 mismatch, still allow undo as a system correction.
  const undoEvent = {
    id: makeId("evt"),
    at: nowIso(),
    type: "vote",
    artistId,
    sessionId,
    watchMs: 0,
    v: 1,
    delta: undoDelta,
    undoOf: lastVoteEventId,
  };

  // lock stays (strategic choice), but undo is a *vote correction* within grace period.
  // We only clear undo window + lastVoteEventId to prevent double-undo.
  a.lastVoteEventId = null;
  a.lastDelta = 0;
  a.undoUntilMs = 0;

  state.updatedAt = nowIso();

  await appendJsonl(VOTES_LOG_FILE, undoEvent);
  await appendJsonl(EVENTS_LOG_FILE, undoEvent);
  await writeJsonAtomic(VOTES_STATE_FILE, state);

  return res.json({
    success: true,
    message: "Vote undone.",
    undoEvent,
    updatedAt: state.updatedAt,
  });
});

export default router;