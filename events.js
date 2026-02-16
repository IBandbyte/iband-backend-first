/**
 * events.js (root) — ESM default export
 * Canonical Event Tracking Router (learning fuel for the iBand algorithm)
 *
 * Final fixes:
 * - totals.{type} increments correctly for ALL types (including replays)
 * - per-artist increments correctly for ALL types
 */

import express from "express";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const router = express.Router();

const DATA_DIR = process.env.DATA_DIR || "/var/data/iband/db";
const EVENTS_LOG_FILE = process.env.EVENTS_LOG_FILE || path.join(DATA_DIR, "events.jsonl");
const EVENTS_AGG_FILE = process.env.EVENTS_AGG_FILE || path.join(DATA_DIR, "events-agg.json");

const EVENTS_ALLOW_LOG = (process.env.EVENTS_ALLOW_LOG || "true").toLowerCase() === "true";
const EVENTS_MAX_BODY_KB = parseInt(process.env.EVENTS_MAX_BODY_KB || "32", 10);

const EVENTS_RATE_WINDOW_SEC = parseInt(process.env.EVENTS_RATE_WINDOW_SEC || "60", 10);
const EVENTS_MAX_PER_WINDOW = parseInt(process.env.EVENTS_MAX_PER_WINDOW || "120", 10);

const AGG_TOP_LIMIT = parseInt(process.env.EVENTS_AGG_TOP_LIMIT || "200", 10);
const routerVersion = 1;

function nowIso() {
  return new Date().toISOString();
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function safeString(v, maxLen = 128) {
  if (!isNonEmptyString(v)) return null;
  return v.trim().slice(0, maxLen);
}

function normalizeId(v, maxLen = 80) {
  const s = safeString(v, maxLen);
  if (!s) return "";
  if (!/^[a-zA-Z0-9._:-]+$/.test(s)) return "";
  return s;
}

function clampInt(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || "unknown";
}

function hashValue(v) {
  return crypto.createHash("sha256").update(String(v)).digest("hex").slice(0, 24);
}

function hashIp(ip) {
  return hashValue(ip);
}

function makeId(prefix = "evt") {
  const rnd = crypto.randomBytes(8).toString("hex");
  return `${prefix}_${Date.now()}_${rnd}`;
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

async function appendJsonl(filePath, obj) {
  await fs.appendFile(filePath, `${JSON.stringify(obj)}\n`, "utf8");
}

function makeRateStore() {
  return { ipWindows: {} };
}

function buildRateWindow(rateStore, ipHash, nowMs) {
  const winMs = EVENTS_RATE_WINDOW_SEC * 1000;
  const cur = rateStore.ipWindows[ipHash];

  if (!cur || typeof cur.windowStart !== "number") {
    rateStore.ipWindows[ipHash] = { windowStart: nowMs, count: 0 };
  } else if (nowMs - cur.windowStart >= winMs) {
    rateStore.ipWindows[ipHash] = { windowStart: nowMs, count: 0 };
  }
  return rateStore.ipWindows[ipHash];
}

function pruneRateStore(rateStore) {
  const nowMs = Date.now();
  const keepBefore = nowMs - (EVENTS_RATE_WINDOW_SEC * 2 * 1000);
  for (const [k, v] of Object.entries(rateStore.ipWindows || {})) {
    if (!v || typeof v.windowStart !== "number" || v.windowStart < keepBefore) delete rateStore.ipWindows[k];
  }
  return rateStore;
}

const rateStore = makeRateStore();

function makeAggSkeleton() {
  return {
    version: 1,
    updatedAt: null,
    totals: {
      events: 0,
      views: 0,
      skips: 0,
      replays: 0,
      likes: 0,
      saves: 0,
      shares: 0,
      follows: 0,
      comments: 0,
      votes: 0,
    },
    byArtist: {},
    byType: {},
    last100: [],
  };
}

function getArtistAgg(agg, artistId) {
  if (!agg.byArtist[artistId]) {
    agg.byArtist[artistId] = {
      events: 0,
      views: 0,
      skips: 0,
      replays: 0,
      likes: 0,
      saves: 0,
      shares: 0,
      follows: 0,
      comments: 0,
      votes: 0,
      watchMs: 0,
      lastAt: null,
    };
  }
  return agg.byArtist[artistId];
}

function inc(obj, key, by = 1) {
  if (!obj[key]) obj[key] = 0;
  obj[key] += by;
}

// ✅ Canonical mapping: event type -> totals key
const TOTALS_KEY = {
  view: "views",
  skip: "skips",
  replay: "replays",
  like: "likes",
  save: "saves",
  share: "shares",
  follow: "follows",
  comment: "comments",
  vote: "votes",
};

function applyAgg(agg, evt) {
  agg.totals.events += 1;

  // byType always
  inc(agg.byType, evt.type, 1);

  // totals per type (correct for ALL types)
  const totalsKey = TOTALS_KEY[evt.type];
  if (totalsKey) agg.totals[totalsKey] += 1;

  // per-artist
  if (evt.artistId) {
    const a = getArtistAgg(agg, evt.artistId);
    a.events += 1;

    const artistKey = TOTALS_KEY[evt.type];
    if (artistKey && a[artistKey] !== undefined) a[artistKey] += 1;

    if (evt.watchMs) a.watchMs += evt.watchMs;
    a.lastAt = evt.at;
  }

  agg.last100.push({
    at: evt.at,
    type: evt.type,
    artistId: evt.artistId || null,
    trackId: evt.trackId || null,
    userId: evt.userId || null,
    sessionId: evt.sessionId || null,
    watchMs: evt.watchMs || 0,
    ipHash: evt.ipHash,
  });
  if (agg.last100.length > 100) agg.last100 = agg.last100.slice(-100);

  agg.updatedAt = nowIso();
  return agg;
}

function compactAgg(agg) {
  const entries = Object.entries(agg.byArtist || {});
  if (entries.length <= AGG_TOP_LIMIT) return agg;

  entries.sort((a, b) => (b[1]?.events || 0) - (a[1]?.events || 0));
  const keep = entries.slice(0, AGG_TOP_LIMIT);
  const next = {};
  for (const [k, v] of keep) next[k] = v;
  agg.byArtist = next;
  return agg;
}

async function loadAgg() {
  await ensureDataDir();
  const base = makeAggSkeleton();
  const agg = await readJsonSafe(EVENTS_AGG_FILE, base);
  if (!agg || typeof agg !== "object") return base;
  if (!agg.totals) agg.totals = base.totals;
  if (!agg.byArtist) agg.byArtist = {};
  if (!agg.byType) agg.byType = {};
  if (!Array.isArray(agg.last100)) agg.last100 = [];
  return agg;
}

async function saveAgg(agg) {
  compactAgg(agg);
  await writeJsonAtomic(EVENTS_AGG_FILE, agg);
}

const ALLOWED_TYPES = new Set(Object.keys(TOTALS_KEY));

function normalizeType(type) {
  const t = safeString(type, 24);
  return t ? t.toLowerCase() : "";
}

function buildEvent(reqBody, req) {
  const type = normalizeType(reqBody?.type);
  if (!ALLOWED_TYPES.has(type)) return { ok: false, error: "Invalid type." };

  const artistId = reqBody?.artistId ? normalizeId(reqBody.artistId) : "";
  const trackId = reqBody?.trackId ? normalizeId(reqBody.trackId) : "";
  const userId = reqBody?.userId ? normalizeId(reqBody.userId, 64) : "";
  const sessionId = reqBody?.sessionId ? normalizeId(reqBody.sessionId, 64) : "";
  const watchMs = reqBody?.watchMs !== undefined ? clampInt(reqBody.watchMs, 0, 60 * 60 * 1000) : 0;

  let meta = null;
  if (reqBody?.meta && typeof reqBody.meta === "object" && !Array.isArray(reqBody.meta)) {
    const m = {};
    for (const [k, v] of Object.entries(reqBody.meta)) {
      const key = safeString(k, 32);
      if (!key) continue;
      if (typeof v === "string") m[key] = v.slice(0, 160);
      else if (typeof v === "number" && Number.isFinite(v)) m[key] = v;
      else if (typeof v === "boolean") m[key] = v;
    }
    meta = Object.keys(m).length ? m : null;
  }

  return {
    ok: true,
    evt: {
      id: makeId("evt"),
      at: nowIso(),
      type,
      artistId: artistId || null,
      trackId: trackId || null,
      userId: userId || null,
      sessionId: sessionId || null,
      watchMs: watchMs || 0,
      ipHash: hashIp(getClientIp(req)),
      meta,
      v: 1,
    },
  };
}

router.use(express.json({ limit: `${EVENTS_MAX_BODY_KB}kb` }));

router.get("/health", async (_req, res) => {
  res.json({
    success: true,
    service: "events",
    version: routerVersion,
    dataDir: DATA_DIR,
    files: { log: path.basename(EVENTS_LOG_FILE), agg: path.basename(EVENTS_AGG_FILE) },
    limits: {
      maxBodyKb: EVENTS_MAX_BODY_KB,
      rateWindowSec: EVENTS_RATE_WINDOW_SEC,
      maxPerWindow: EVENTS_MAX_PER_WINDOW,
      aggTopLimit: AGG_TOP_LIMIT,
      allowLog: EVENTS_ALLOW_LOG,
    },
    updatedAt: nowIso(),
  });
});

router.get("/stats", async (_req, res) => {
  const agg = await loadAgg();
  res.json({
    success: true,
    updatedAt: agg.updatedAt,
    totals: agg.totals,
    types: agg.byType,
    artistsTracked: Object.keys(agg.byArtist || {}).length,
  });
});

router.get("/artist/:artistId", async (req, res) => {
  const artistId = normalizeId(req.params.artistId);
  if (!artistId) return res.status(400).json({ success: false, message: "Invalid artistId." });
  const agg = await loadAgg();
  const bucket = agg.byArtist?.[artistId];
  if (!bucket) return res.status(404).json({ success: false, message: "No events found for this artist." });
  res.json({ success: true, artistId, updatedAt: agg.updatedAt, summary: bucket });
});

router.get("/recent", async (_req, res) => {
  const agg = await loadAgg();
  res.json({ success: true, updatedAt: agg.updatedAt, last100: agg.last100 || [] });
});

router.post("/", async (req, res) => {
  const ipHash = hashIp(getClientIp(req));
  const nowMs = Date.now();
  const win = buildRateWindow(rateStore, ipHash, nowMs);

  if (win.count >= EVENTS_MAX_PER_WINDOW) {
    const retryAfterSec = Math.max(
      0,
      Math.ceil(((win.windowStart + EVENTS_RATE_WINDOW_SEC * 1000) - nowMs) / 1000)
    );
    return res.status(429).json({
      success: false,
      message: "Rate limit exceeded for events. Try again later.",
      retryAfterSec,
    });
  }

  const built = buildEvent(req.body, req);
  if (!built.ok) return res.status(400).json({ success: false, message: built.error });

  win.count += 1;
  pruneRateStore(rateStore);

  await ensureDataDir();

  if (EVENTS_ALLOW_LOG) {
    try {
      await appendJsonl(EVENTS_LOG_FILE, built.evt);
    } catch {}
  }

  const agg = await loadAgg();
  applyAgg(agg, built.evt);
  await saveAgg(agg);

  res.json({
    success: true,
    message: "Event recorded.",
    event: {
      id: built.evt.id,
      at: built.evt.at,
      type: built.evt.type,
      artistId: built.evt.artistId,
      trackId: built.evt.trackId,
      userId: built.evt.userId,
      sessionId: built.evt.sessionId,
      watchMs: built.evt.watchMs,
      v: built.evt.v,
    },
    updatedAt: agg.updatedAt,
  });
});

export default router;