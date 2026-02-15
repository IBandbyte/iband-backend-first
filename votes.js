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

const ADMIN_KEY = process.env.ADMIN_KEY || "";

const RATE_LIMIT_WINDOW_SEC = parseInt(process.env.VOTES_RATE_WINDOW_SEC || "3600", 10);
const MAX_VOTES_PER_WINDOW = parseInt(process.env.VOTES_MAX_PER_WINDOW || "30", 10);

const ARTIST_COOLDOWN_SEC = parseInt(process.env.VOTES_ARTIST_COOLDOWN_SEC || "30", 10);
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
  const trimmed = id.trim();
  if (trimmed.length > 80) return "";
  if (!/^[a-zA-Z0-9._:-]+$/.test(trimmed)) return "";
  return trimmed;
}

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || "unknown";
}

function hashIp(ip) {
  return crypto.createHash("sha256").update(String(ip)).digest("hex").slice(0, 24);
}

function adminAuthOk(req) {
  if (!ADMIN_KEY) return false;
  const headerKey = req.headers["x-admin-key"];
  return typeof headerKey === "string" && headerKey === ADMIN_KEY;
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
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
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

async function appendLedger(eventObj) {
  if (!ALLOW_LEDGER) return;
  try {
    await fs.appendFile(LEDGER_FILE, `${JSON.stringify(eventObj)}\n`, "utf8");
  } catch {
    // best-effort only
  }
}

function makeStoreSkeleton() {
  return {
    version: 1,
    updatedAt: nowIso(),
    artists: {},
    ipWindows: {},
    ipArtistCooldown: {},
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
  return (nowMs - lastAt) >= (ARTIST_COOLDOWN_SEC * 1000);
}

function setArtistCooldown(store, ipHash, artistId, nowMs) {
  store.ipArtistCooldown[cooldownKey(ipHash, artistId)] = nowMs;
}

function getOrCreateArtistBucket(store, artistId) {
  if (!store.artists[artistId]) {
    store.artists[artistId] = { votes: 0, lastVoteAt: null, recent: [] };
  }
  return store.artists[artistId];
}

function pruneMemory(store) {
  for (const [artistId, bucket] of Object.entries(store.artists || {})) {
    if (Array.isArray(bucket.recent) && bucket.recent.length > RECENT_EVENTS_PER_ARTIST) {
      bucket.recent = bucket.recent.slice(-RECENT_EVENTS_PER_ARTIST);
    }
    bucket.votes = Number.isFinite(bucket.votes) ? Math.trunc(bucket.votes) : 0;
    store.artists[artistId] = bucket;
  }

  const nowMs = Date.now();

  const keepBefore = nowMs - (RATE_LIMIT_WINDOW_SEC * 2 * 1000);
  for (const [k, v] of Object.entries(store.ipWindows || {})) {
    if (!v || typeof v.windowStart !== "number" || v.windowStart < keepBefore) delete store.ipWindows[k];
  }

  const cooldownKeepBefore = nowMs - (24 * 60 * 60 * 1000);
  for (const [k, lastAt] of Object.entries(store.ipArtistCooldown || {})) {
    if (typeof lastAt !== "number" || lastAt < cooldownKeepBefore) delete store.ipArtistCooldown[k];
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
 * Core vote handler (single source of truth)
 * ------------------------------*/
async function handleVote(req, res, { artistIdInput, deltaInput }) {
  const artistId = normalizeArtistId(artistIdInput);
  if (!artistId) return res.status(400).json({ success: false, message: "artistId is required." });

  let delta = deltaInput;
  if (delta === undefined || delta === null || delta === "") delta = 1;
  delta = Number(delta);

  if (!Number.isFinite(delta)) return res.status(400).json({ success: false, message: "delta must be a number." });

  delta = Math.trunc(delta);
  if (delta !== 1 && delta !== -1) return res.status(400).json({ success: false, message: "delta must be 1 or -1." });

  if (delta === -1 && !ALLOW_DOWNVOTE) return res.status(403).json({ success: false, message: "Downvotes are disabled." });

  const voterId = isNonEmptyString(req.body?.voterId) ? req.body.voterId.trim().slice(0, 64) : null;

  const ipHash = hashIp(getClientIp(req));
  const nowMs = Date.now();

  const store = await loadStore();

  // 1) Per-IP global window rate limit
  const ipWindow = buildRateLimitState(store, ipHash, nowMs);
  if (ipWindow.count >= MAX_VOTES_PER_WINDOW) {
    const retryAfterSec = Math.max(
      0,
      Math.ceil(((ipWindow.windowStart + RATE_LIMIT_WINDOW_SEC * 1000) - nowMs) / 1000)
    );
    return res.status(429).json({
      success: false,
      message: "Rate limit exceeded. Try again later.",
      retryAfterSec,
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

  const bucket = getOrCreateArtistBucket(store, artistId);

  const currentVotes = Number.isFinite(bucket.votes) ? bucket.votes : 0;
  const nextVotes = clamp(currentVotes + delta, 0, Number.MAX_SAFE_INTEGER);

  if (nextVotes === currentVotes && delta === -1) {
    return res.status(409).json({
      success: false,
      message: "Vote total cannot go below 0.",
      artistId,
      votes: currentVotes,
    });
  }

  const at = nowIso();
  bucket.votes = nextVotes;
  bucket.lastVoteAt = at;
  bucket.recent = Array.isArray(bucket.recent) ? bucket.recent : [];
  bucket.recent.push({
    at,
    delta,
    ipHash,
    ...(voterId ? { voterId } : {}),
  });

  store.artists[artistId] = bucket;

  // Update anti-spam state (must happen BEFORE save)
  ipWindow.count += 1;
  setArtistCooldown(store, ipHash, artistId, nowMs);

  await saveStore(store);

  await appendLedger({
    at,
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
    artist: { id: artistId, votes: bucket.votes, lastVoteAt: bucket.lastVoteAt },
    updatedAt: store.updatedAt || null,
  });
}

/** -----------------------------
 * Middleware
 * ------------------------------*/
router.use(express.json({ limit: "64kb" }));

/** -----------------------------
 * GET endpoints
 * ------------------------------*/
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

router.get("/artist/:artistId", async (req, res) => {
  const artistId = normalizeArtistId(req.params.artistId);
  if (!artistId) return res.status(400).json({ success: false, message: "Invalid artistId." });

  const store = await loadStore();
  const bucket = store.artists?.[artistId];
  if (!bucket) return res.status(404).json({ success: false, message: "No votes found for this artist." });

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
 * POST endpoints
 * ------------------------------*/
router.post("/", async (req, res) => {
  return handleVote(req, res, {
    artistIdInput: req.body?.artistId,
    deltaInput: req.body?.delta,
  });
});

router.post("/artist/:artistId/up", async (req, res) => {
  return handleVote(req, res, {
    artistIdInput: req.params.artistId,
    deltaInput: 1,
  });
});

router.post("/artist/:artistId/down", async (req, res) => {
  return handleVote(req, res, {
    artistIdInput: req.params.artistId,
    deltaInput: -1,
  });
});

/** -----------------------------
 * DELETE endpoints (admin-only)
 * ------------------------------*/
router.delete("/artist/:artistId", async (req, res) => {
  if (!adminAuthOk(req)) return res.status(401).json({ success: false, message: "Unauthorized." });

  const artistId = normalizeArtistId(req.params.artistId);
  if (!artistId) return res.status(400).json({ success: false, message: "Invalid artistId." });

  const store = await loadStore();
  if (!store.artists?.[artistId]) return res.status(404).json({ success: false, message: "No votes found for this artist." });

  delete store.artists[artistId];
  await saveStore(store);

  return res.json({ success: true, message: "Votes cleared for artist.", artistId });
});

router.delete("/reset", async (req, res) => {
  if (!adminAuthOk(req)) return res.status(401).json({ success: false, message: "Unauthorized." });

  const store = makeStoreSkeleton();
  await ensureDataDir();
  await writeJsonAtomic(VOTES_FILE, store);

  return res.json({ success: true, message: "Votes store reset.", updatedAt: store.updatedAt });
});

export default router;