/**
 * votes.js (root) — ESM default export
 * Canonical Votes Router (future-proof)
 *
 * Mount in server.js:
 *   import votesRouter from "./votes.js";
 *   app.use("/api/votes", votesRouter);
 *
 * Goals:
 * - Anti-spam: lightweight per-IP rate limiting + per-artist cooldown
 * - Extensible: supports voterId/deviceId later, downvotes, admin reset, stats
 * - Persistence: file-based storage compatible with Render persistent disk
 *
 * Storage (DATA_DIR):
 * - votes.json:      { version, updatedAt, artists: { [artistId]: { votes, lastVoteAt, recent: [] } }, ipWindows: { [ipKey]: { windowStart, count } }, ipArtistCooldown: { [ipKey|artistId]: lastAt } }
 * - votes-ledger.jsonl (optional append): audit trail of vote events
 */

import express from "express";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const router = express.Router();

/** -----------------------------
 * Config (safe defaults)
 * ------------------------------*/
const DATA_DIR = process.env.DATA_DIR || "/var/data/iband/db";
const VOTES_FILE = process.env.VOTES_FILE || path.join(DATA_DIR, "votes.json");
const LEDGER_FILE = process.env.VOTES_LEDGER_FILE || path.join(DATA_DIR, "votes-ledger.jsonl");

const ADMIN_KEY = process.env.ADMIN_KEY || ""; // set in Render for admin-only endpoints

const RATE_LIMIT_WINDOW_SEC = parseInt(process.env.VOTES_RATE_WINDOW_SEC || "3600", 10); // 1 hour
const MAX_VOTES_PER_WINDOW = parseInt(process.env.VOTES_MAX_PER_WINDOW || "30", 10);

const ARTIST_COOLDOWN_SEC = parseInt(process.env.VOTES_ARTIST_COOLDOWN_SEC || "30", 10); // same IP -> same artist cooldown
const RECENT_EVENTS_PER_ARTIST = parseInt(process.env.VOTES_RECENT_EVENTS_PER_ARTIST || "30", 10);

const ALLOW_DOWNVOTE = (process.env.VOTES_ALLOW_DOWNVOTE || "true").toLowerCase() === "true";
const ALLOW_LEDGER = (process.env.VOTES_ALLOW_LEDGER || "true").toLowerCase() === "true";

/** -----------------------------
 * Utilities
 * ------------------------------*/
function nowIso() {
  return new Date().toISOString();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeArtistId(id) {
  if (!isNonEmptyString(id)) return "";
  // allow simple slugs/ids (keep it flexible)
  const trimmed = id.trim();
  if (trimmed.length > 80) return "";
  // basic safe charset; loosen if you need UUIDs, etc.
  if (!/^[a-zA-Z0-9._:-]+$/.test(trimmed)) return "";
  return trimmed;
}

function getClientIp(req) {
  // Render/Proxies commonly set x-forwarded-for
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) {
    return xff.split(",")[0].trim();
  }
  // fallback
  return req.ip || req.connection?.remoteAddress || "unknown";
}

function hashIp(ip) {
  // store hashed IP keys to reduce exposure risk
  return crypto.createHash("sha256").update(String(ip)).digest("hex").slice(0, 24);
}

function adminAuthOk(req) {
  if (!ADMIN_KEY) return false;
  const headerKey = req.headers["x-admin-key"];
  if (typeof headerKey !== "string") return false;
  return headerKey === ADMIN_KEY;
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJsonSafe(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

async function writeJsonAtomic(filePath, obj) {
  const tmp = `${filePath}.tmp`;
  const data = JSON.stringify(obj, null, 2);
  await fs.writeFile(tmp, data, "utf8");
  await fs.rename(tmp, filePath);
}

async function appendLedger(eventObj) {
  if (!ALLOW_LEDGER) return;
  try {
    const line = `${JSON.stringify(eventObj)}\n`;
    await fs.appendFile(LEDGER_FILE, line, "utf8");
  } catch {
    // ledger is best-effort; never block the main vote flow
  }
}

function makeStoreSkeleton() {
  return {
    version: 1,
    updatedAt: nowIso(),
    artists: {}, // { [artistId]: { votes:number, lastVoteAt:iso, recent:[{at, delta, ipHash, voterId?}] } }
    ipWindows: {}, // { [ipHash]: { windowStart:number(ms), count:number } }
    ipArtistCooldown: {}, // { ["ipHash|artistId"]: lastAt:number(ms) }
  };
}

function windowKey(ipHash) {
  return ipHash;
}

function cooldownKey(ipHash, artistId) {
  return `${ipHash}|${artistId}`;
}

function buildRateLimitState(store, ipHash, nowMs) {
  const key = windowKey(ipHash);
  const current = store.ipWindows[key];

  const windowMs = RATE_LIMIT_WINDOW_SEC * 1000;
  if (!current || typeof current.windowStart !== "number") {
    store.ipWindows[key] = { windowStart: nowMs, count: 0 };
  } else {
    const elapsed = nowMs - current.windowStart;
    if (elapsed >= windowMs) {
      store.ipWindows[key] = { windowStart: nowMs, count: 0 };
    }
  }
  return store.ipWindows[key];
}

function canVoteOnArtist(store, ipHash, artistId, nowMs) {
  const key = cooldownKey(ipHash, artistId);
  const lastAt = store.ipArtistCooldown[key];
  if (typeof lastAt !== "number") return true;
  const cooldownMs = ARTIST_COOLDOWN_SEC * 1000;
  return (nowMs - lastAt) >= cooldownMs;
}

function setArtistCooldown(store, ipHash, artistId, nowMs) {
  const key = cooldownKey(ipHash, artistId);
  store.ipArtistCooldown[key] = nowMs;
}

function getOrCreateArtistBucket(store, artistId) {
  if (!store.artists[artistId]) {
    store.artists[artistId] = {
      votes: 0,
      lastVoteAt: null,
      recent: [],
    };
  }
  return store.artists[artistId];
}

function pruneMemory(store) {
  // Basic hygiene to keep file from growing forever
  // 1) Trim recent arrays
  for (const [artistId, bucket] of Object.entries(store.artists || {})) {
    if (Array.isArray(bucket.recent) && bucket.recent.length > RECENT_EVENTS_PER_ARTIST) {
      bucket.recent = bucket.recent.slice(-RECENT_EVENTS_PER_ARTIST);
    }
    // ensure votes int
    bucket.votes = Number.isFinite(bucket.votes) ? Math.trunc(bucket.votes) : 0;
    store.artists[artistId] = bucket;
  }

  // 2) Prune old ipWindows beyond 2 windows
  const nowMs = Date.now();
  const keepBefore = nowMs - (RATE_LIMIT_WINDOW_SEC * 2 * 1000);
  for (const [k, v] of Object.entries(store.ipWindows || {})) {
    if (!v || typeof v.windowStart !== "number" || v.windowStart < keepBefore) {
      delete store.ipWindows[k];
    }
  }

  // 3) Prune cooldown keys older than 24h
  const cooldownKeepBefore = nowMs - (24 * 60 * 60 * 1000);
  for (const [k, lastAt] of Object.entries(store.ipArtistCooldown || {})) {
    if (typeof lastAt !== "number" || lastAt < cooldownKeepBefore) {
      delete store.ipArtistCooldown[k];
    }
  }

  return store;
}

/** -----------------------------
 * Load / Save store
 * ------------------------------*/
async function loadStore() {
  await ensureDataDir();
  const base = makeStoreSkeleton();
  const store = await readJsonSafe(VOTES_FILE, base);

  // Hardening
  if (!store || typeof store !== "object") return base;
  if (!store.artists || typeof store.artists !== "object") store.artists = {};
  if (!store.ipWindows || typeof store.ipWindows !== "object") store.ipWindows = {};
  if (!store.ipArtistCooldown || typeof store.ipArtistCooldown !== "object") store.ipArtistCooldown = {};

  return store;
}

async function saveStore(store) {
  store.updatedAt = nowIso();
  pruneMemory(store);
  await writeJsonAtomic(VOTES_FILE, store);
}

/** -----------------------------
 * Middleware: JSON body safe
 * ------------------------------*/
router.use(express.json({ limit: "64kb" }));

/** -----------------------------
 * GET endpoints (grouped)
 * ------------------------------*/

/**
 * GET /api/votes/health
 */
router.get("/health", async (_req, res) => {
  return res.json({
    success: true,
    service: "votes",
    version: 1,
    dataDir: DATA_DIR,
    updatedAt: nowIso(),
    limits: {
      rateWindowSec: RATE_LIMIT_WINDOW_SEC,
      maxVotesPerWindow: MAX_VOTES_PER_WINDOW,
      artistCooldownSec: ARTIST_COOLDOWN_SEC,
      allowDownvote: ALLOW_DOWNVOTE,
    },
  });
});

/**
 * GET /api/votes/stats
 * Basic aggregated info for debugging
 */
router.get("/stats", async (_req, res) => {
  const store = await loadStore();
  const artistsCount = Object.keys(store.artists || {}).length;
  let totalVotes = 0;
  for (const bucket of Object.values(store.artists || {})) {
    totalVotes += Number.isFinite(bucket?.votes) ? bucket.votes : 0;
  }
  return res.json({
    success: true,
    artistsCount,
    totalVotes,
    updatedAt: store.updatedAt || null,
  });
});

/**
 * GET /api/votes/artist/:artistId
 * Returns vote total + recent events (hashed IP only)
 */
router.get("/artist/:artistId", async (req, res) => {
  const artistId = normalizeArtistId(req.params.artistId);
  if (!artistId) {
    return res.status(400).json({ success: false, message: "Invalid artistId." });
  }

  const store = await loadStore();
  const bucket = store.artists?.[artistId];

  if (!bucket) {
    return res.status(404).json({ success: false, message: "No votes found for this artist." });
  }

  return res.json({
    success: true,
    artistId,
    votes: bucket.votes ?? 0,
    lastVoteAt: bucket.lastVoteAt ?? null,
    recent: Array.isArray(bucket.recent) ? bucket.recent : [],
    updatedAt: store.updatedAt || null,
  });
});

/** -----------------------------
 * POST endpoints (grouped)
 * ------------------------------*/

/**
 * POST /api/votes
 * Body: { artistId: string, delta?: 1|-1, voterId?: string }
 *
 * Notes:
 * - delta defaults to +1
 * - downvote allowed only when VOTES_ALLOW_DOWNVOTE=true
 */
router.post("/", async (req, res) => {
  const artistId = normalizeArtistId(req.body?.artistId);
  if (!artistId) {
    return res.status(400).json({ success: false, message: "artistId is required." });
  }

  let delta = req.body?.delta;
  if (delta === undefined || delta === null || delta === "") delta = 1;
  delta = Number(delta);

  if (!Number.isFinite(delta)) {
    return res.status(400).json({ success: false, message: "delta must be a number." });
  }

  // Only allow -1 or +1 for now (future-proof contract)
  delta = Math.trunc(delta);
  if (delta !== 1 && delta !== -1) {
    return res.status(400).json({ success: false, message: "delta must be 1 or -1." });
  }

  if (delta === -1 && !ALLOW_DOWNVOTE) {
    return res.status(403).json({ success: false, message: "Downvotes are disabled." });
  }

  const voterId = isNonEmptyString(req.body?.voterId) ? req.body.voterId.trim().slice(0, 64) : null;

  const ip = getClientIp(req);
  const ipHash = hashIp(ip);
  const nowMs = Date.now();

  const store = await loadStore();

  // 1) Per-IP global rate limiting window
  const ipWindow = buildRateLimitState(store, ipHash, nowMs);
  if (ipWindow.count >= MAX_VOTES_PER_WINDOW) {
    const windowEndsInSec = Math.max(
      0,
      Math.ceil(((ipWindow.windowStart + RATE_LIMIT_WINDOW_SEC * 1000) - nowMs) / 1000)
    );
    return res.status(429).json({
      success: false,
      message: "Rate limit exceeded. Try again later.",
      retryAfterSec: windowEndsInSec,
    });
  }

  // 2) Per-IP per-artist cooldown
  if (!canVoteOnArtist(store, ipHash, artistId, nowMs)) {
    return res.status(429).json({
      success: false,
      message: "Cooldown active for this artist. Please wait a moment.",
      cooldownSec: ARTIST_COOLDOWN_SEC,
    });
  }

  // Apply vote
  const bucket = getOrCreateArtistBucket(store, artistId);

  // prevent negative totals (optional); keep it stable and non-abusive
  const nextVotes = clamp((bucket.votes ?? 0) + delta, 0, Number.MAX_SAFE_INTEGER);

  // If clamp changed it (e.g. trying to downvote below 0), treat as no-op
  if (nextVotes === (bucket.votes ?? 0) && delta === -1) {
    return res.status(409).json({
      success: false,
      message: "Vote total cannot go below 0.",
      artistId,
      votes: bucket.votes ?? 0,
    });
  }

  bucket.votes = nextVotes;
  bucket.lastVoteAt = nowIso();
  bucket.recent = Array.isArray(bucket.recent) ? bucket.recent : [];
  bucket.recent.push({
    at: bucket.lastVoteAt,
    delta,
    ipHash, // hashed only
    ...(voterId ? { voterId } : {}),
  });

  store.artists[artistId] = bucket;

  // Update anti-spam state
  ipWindow.count += 1;
  setArtistCooldown(store, ipHash, artistId, nowMs);

  // Persist
  await saveStore(store);

  // Best-effort audit trail
  await appendLedger({
    at: bucket.lastVoteAt,
    artistId,
    delta,
    ipHash,
    ...(voterId ? { voterId } : {}),
  });

  return res.json({
    success: true,
    message: "Vote recorded.",
    artistId,
    delta,
    votes: bucket.votes,
    artist: {
      id: artistId,
      votes: bucket.votes,
      lastVoteAt: bucket.lastVoteAt,
    },
    updatedAt: store.updatedAt || null,
  });
});

/**
 * POST /api/votes/artist/:artistId/up
 */
router.post("/artist/:artistId/up", async (req, res) => {
  req.body = { ...(req.body || {}), artistId: req.params.artistId, delta: 1 };
  return router.handle(req, res);
});

/**
 * POST /api/votes/artist/:artistId/down
 */
router.post("/artist/:artistId/down", async (req, res) => {
  req.body = { ...(req.body || {}), artistId: req.params.artistId, delta: -1 };
  return router.handle(req, res);
});

/** -----------------------------
 * DELETE endpoints (admin-only)
 * ------------------------------*/

/**
 * DELETE /api/votes/artist/:artistId
 * Header: x-admin-key: <ADMIN_KEY>
 * Clears votes for a single artist (admin only)
 */
router.delete("/artist/:artistId", async (req, res) => {
  if (!adminAuthOk(req)) {
    return res.status(401).json({ success: false, message: "Unauthorized." });
  }

  const artistId = normalizeArtistId(req.params.artistId);
  if (!artistId) {
    return res.status(400).json({ success: false, message: "Invalid artistId." });
  }

  const store = await loadStore();
  if (!store.artists?.[artistId]) {
    return res.status(404).json({ success: false, message: "No votes found for this artist." });
  }

  delete store.artists[artistId];
  await saveStore(store);

  return res.json({ success: true, message: "Votes cleared for artist.", artistId });
});

/**
 * DELETE /api/votes/reset
 * Header: x-admin-key: <ADMIN_KEY>
 * Clears the entire votes store (admin only)
 */
router.delete("/reset", async (req, res) => {
  if (!adminAuthOk(req)) {
    return res.status(401).json({ success: false, message: "Unauthorized." });
  }

  const store = makeStoreSkeleton();
  await ensureDataDir();
  await writeJsonAtomic(VOTES_FILE, store);

  return res.json({ success: true, message: "Votes store reset.", updatedAt: store.updatedAt });
});

export default router;