/**
 * shares.js (Phase H4) - ESM
 * --------------------------
 * Share Attribution Service (persistent on Render disk)
 *
 * Storage:
 *   /var/data/iband/db/shares/
 *     events/shares.jsonl
 *     cache/shares-cache.json (optional, small)
 *
 * Core goals:
 * - Record share events with referrerFanId (the fan who shared)
 * - Provide basic counters for artist/track
 * - Keep it safe: rate limiting, payload limits, dedupe
 *
 * Endpoints:
 * - GET  /api/shares/health
 * - POST /api/shares/share
 * - GET  /api/shares/artist/:artistId?days=120
 * - GET  /api/shares/track/:artistId/:trackId?days=120
 */

import express from "express";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";

const router = express.Router();

// ----------------------------
// Persistent storage (Render disk)
// ----------------------------
const DATA_DIR = process.env.IBAND_DATA_DIR || "/var/data/iband/db";
const SHARES_DIR = path.join(DATA_DIR, "shares");
const EVENTS_DIR = path.join(SHARES_DIR, "events");
const CACHE_DIR = path.join(SHARES_DIR, "cache");

const SHARES_JSONL = path.join(EVENTS_DIR, "shares.jsonl");

// ----------------------------
// Limits + tuning
// ----------------------------
const LIMITS = {
  maxBodyBytes: 20_000,
  maxReadBytes: 15 * 1024 * 1024,
  maxLineScan: 120_000
};

const DEDUPE = {
  // Dedupe window for identical shares from same fan for same asset
  windowMs: 5 * 60 * 1000
};

const RATE = {
  windowMs: 30_000,
  max: 120
};

// ----------------------------
// In-memory caches (safe MVP)
// ----------------------------
const rateBuckets = new Map(); // ip -> {count, resetAt}
const recentDedupe = new Map(); // dedupeKey -> lastTsMs

// ----------------------------
// Helpers
// ----------------------------
function nowIso() {
  return new Date().toISOString();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function safeJsonParse(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

async function ensureDirs() {
  await fsp.mkdir(EVENTS_DIR, { recursive: true });
  await fsp.mkdir(CACHE_DIR, { recursive: true });
}

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function ipKey(req) {
  return (
    (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
    req.ip ||
    "unknown"
  );
}

function rateLimit(req, res, next) {
  const key = ipKey(req);
  const now = Date.now();
  const bucket = rateBuckets.get(key) || { count: 0, resetAt: now + RATE.windowMs };

  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + RATE.windowMs;
  }

  bucket.count += 1;
  rateBuckets.set(key, bucket);

  if (bucket.count > RATE.max) {
    return res.status(429).json({
      success: false,
      error: "rate_limited",
      message: "Too many requests. Please slow down."
    });
  }
  next();
}

function normalizeShare(body) {
  const ts = body.ts ? new Date(body.ts) : new Date();
  const tsIso = isNaN(ts.getTime()) ? new Date() : ts;

  // assetType: "track" | "artist" | "room" | "post" (future-proof)
  const assetType = (body.assetType || "track").toString().trim().toLowerCase();

  const evt = {
    type: "share",
    ts: tsIso.toISOString(),

    // core attribution
    referrerFanId: (body.referrerFanId || body.fanId || "").toString().trim(),

    // target
    artistId: (body.artistId || "").toString().trim(),
    trackId: (body.trackId || "").toString().trim(),
    assetType,

    // context
    channel: (body.channel || "unknown").toString().trim().toLowerCase(), // whatsapp, instagram, tiktok, etc.
    placement: (body.placement || "unknown").toString().trim().toLowerCase(), // feed, profile, forum, room
    country: (body.country || "").toString().trim().toUpperCase(),
    locale: (body.locale || "").toString().trim(),
    ref: (body.ref || "").toString().trim(), // campaign id / share link ref
    meta: typeof body.meta === "object" && body.meta ? body.meta : {}
  };

  // stable-ish id for storage (not for security)
  evt.id = (body.id || "").toString().trim() || sha256(
    [
      evt.type,
      evt.referrerFanId,
      evt.artistId,
      evt.trackId,
      evt.assetType,
      evt.channel,
      evt.placement,
      evt.ref,
      evt.ts
    ].join("|")
  ).slice(0, 24);

  return evt;
}

function validateShare(evt) {
  const allowedAsset = new Set(["track", "artist", "room", "post"]);

  if (!evt.referrerFanId) return { ok: false, message: "Missing 'referrerFanId'." };
  if (!evt.artistId) return { ok: false, message: "Missing 'artistId'." };

  if (!allowedAsset.has(evt.assetType)) {
    return { ok: false, message: "Invalid 'assetType'." };
  }

  if (evt.assetType === "track" && !evt.trackId) {
    return { ok: false, message: "Missing 'trackId' for track share." };
  }

  // meta size guard
  try {
    const metaBytes = Buffer.byteLength(JSON.stringify(evt.meta || {}), "utf8");
    if (metaBytes > 6000) return { ok: false, message: "'meta' too large." };
  } catch {
    return { ok: false, message: "Invalid 'meta'." };
  }

  return { ok: true };
}

function dedupeKey(evt) {
  // same fan sharing the same thing in the same channel/placement counts once per window
  return [
    evt.referrerFanId,
    evt.artistId,
    evt.trackId || "",
    evt.assetType,
    evt.channel,
    evt.placement
  ].join("|");
}

function isDuplicate(evt) {
  const k = dedupeKey(evt);
  const now = Date.now();
  const last = recentDedupe.get(k) || 0;
  if (now - last < DEDUPE.windowMs) return true;
  recentDedupe.set(k, now);
  return false;
}

async function appendJsonl(filePath, obj) {
  await ensureDirs();
  await fsp.appendFile(filePath, JSON.stringify(obj) + "\n", "utf8");
}

async function safeReadJsonlLines(filePath, maxBytes) {
  await ensureDirs();
  try {
    const stat = await fsp.stat(filePath);
    if (stat.size > maxBytes) {
      const fd = await fsp.open(filePath, "r");
      try {
        const start = Math.max(0, stat.size - maxBytes);
        const len = stat.size - start;
        const buf = Buffer.alloc(len);
        await fd.read(buf, 0, len, start);
        return buf.toString("utf8").split("\n").filter(Boolean);
      } finally {
        await fd.close();
      }
    }
    const raw = await fsp.readFile(filePath, "utf8");
    return raw.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function withinLookback(tsIso, days) {
  const t = new Date(tsIso).getTime();
  if (!Number.isFinite(t)) return false;
  const ageMs = Date.now() - t;
  const maxMs = clamp(Number(days) || 120, 1, 365) * 24 * 60 * 60 * 1000;
  return ageMs <= maxMs;
}

// ----------------------------
// Middleware
// ----------------------------
router.use(rateLimit);

// ----------------------------
// Routes
// ----------------------------
router.get("/health", async (req, res) => {
  await ensureDirs();

  let stat = null;
  try {
    stat = await fsp.stat(SHARES_JSONL);
  } catch {
    stat = null;
  }

  return res.json({
    success: true,
    service: "shares",
    phase: "H4",
    storageDir: SHARES_DIR,
    eventsFile: {
      path: SHARES_JSONL,
      ok: !!stat,
      size: stat ? stat.size : 0,
      mtimeMs: stat ? stat.mtimeMs : null
    },
    limits: LIMITS,
    dedupe: { windowMs: DEDUPE.windowMs },
    ts: nowIso()
  });
});

router.post("/share", async (req, res) => {
  // payload guard
  try {
    const bytes = Buffer.byteLength(JSON.stringify(req.body || {}), "utf8");
    if (bytes > LIMITS.maxBodyBytes) {
      return res.status(413).json({ success: false, error: "payload_too_large" });
    }
  } catch {
    return res.status(400).json({ success: false, error: "invalid_body" });
  }

  const evt = normalizeShare(req.body || {});
  const v = validateShare(evt);
  if (!v.ok) {
    return res.status(400).json({ success: false, error: "validation_error", message: v.message });
  }

  if (isDuplicate(evt)) {
    return res.json({
      success: true,
      message: "Duplicate share ignored (dedupe window).",
      deduped: true,
      id: evt.id,
      ts: evt.ts
    });
  }

  await appendJsonl(SHARES_JSONL, evt);

  return res.json({
    success: true,
    message: "Share recorded.",
    deduped: false,
    id: evt.id,
    referrerFanId: evt.referrerFanId,
    artistId: evt.artistId,
    trackId: evt.trackId || null,
    assetType: evt.assetType,
    ts: evt.ts
  });
});

router.get("/artist/:artistId", async (req, res) => {
  const artistId = (req.params.artistId || "").toString().trim();
  if (!artistId) return res.status(400).json({ success: false, error: "missing_artistId" });

  const days = clamp(Number(req.query.days) || 120, 1, 365);
  const maxBytes = LIMITS.maxReadBytes;
  const maxLines = LIMITS.maxLineScan;

  const lines = await safeReadJsonlLines(SHARES_JSONL, maxBytes);

  let scanned = 0;
  let shares = 0;
  const uniqueReferrers = new Set();
  const channels = new Map(); // channel -> count

  for (let i = lines.length - 1; i >= 0; i--) {
    scanned += 1;
    if (scanned > maxLines) break;

    const evt = safeJsonParse(lines[i]);
    if (!evt || evt.type !== "share") continue;
    if (evt.artistId !== artistId) continue;
    if (!withinLookback(evt.ts, days)) continue;

    shares += 1;
    if (evt.referrerFanId) uniqueReferrers.add(evt.referrerFanId);

    const ch = (evt.channel || "unknown").toString();
    channels.set(ch, (channels.get(ch) || 0) + 1);
  }

  const channelBreakdown = Array.from(channels.entries())
    .map(([channel, count]) => ({ channel, count }))
    .sort((a, b) => b.count - a.count);

  return res.json({
    success: true,
    artistId,
    days,
    shares,
    uniqueReferrers: uniqueReferrers.size,
    channels: channelBreakdown,
    updatedAt: nowIso(),
    debug: { scannedLines: scanned }
  });
});

router.get("/track/:artistId/:trackId", async (req, res) => {
  const artistId = (req.params.artistId || "").toString().trim();
  const trackId = (req.params.trackId || "").toString().trim();
  if (!artistId) return res.status(400).json({ success: false, error: "missing_artistId" });
  if (!trackId) return res.status(400).json({ success: false, error: "missing_trackId" });

  const days = clamp(Number(req.query.days) || 120, 1, 365);
  const maxBytes = LIMITS.maxReadBytes;
  const maxLines = LIMITS.maxLineScan;

  const lines = await safeReadJsonlLines(SHARES_JSONL, maxBytes);

  let scanned = 0;
  let shares = 0;
  const uniqueReferrers = new Set();
  const channels = new Map();

  for (let i = lines.length - 1; i >= 0; i--) {
    scanned += 1;
    if (scanned > maxLines) break;

    const evt = safeJsonParse(lines[i]);
    if (!evt || evt.type !== "share") continue;
    if (evt.artistId !== artistId) continue;
    if (evt.assetType !== "track") continue;
    if (evt.trackId !== trackId) continue;
    if (!withinLookback(evt.ts, days)) continue;

    shares += 1;
    if (evt.referrerFanId) uniqueReferrers.add(evt.referrerFanId);

    const ch = (evt.channel || "unknown").toString();
    channels.set(ch, (channels.get(ch) || 0) + 1);
  }

  const channelBreakdown = Array.from(channels.entries())
    .map(([channel, count]) => ({ channel, count }))
    .sort((a, b) => b.count - a.count);

  return res.json({
    success: true,
    artistId,
    trackId,
    days,
    shares,
    uniqueReferrers: uniqueReferrers.size,
    channels: channelBreakdown,
    updatedAt: nowIso(),
    debug: { scannedLines: scanned }
  });
});

export default router;