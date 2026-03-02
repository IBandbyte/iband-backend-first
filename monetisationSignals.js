/**
 * monetisationSignals.js (Phase H3) - ESM
 * --------------------------------------
 * Records monetisation-related events into a JSONL stream (temporary before DB)
 * Provides aggregation endpoints for artist monetisation + fan loyalty.
 */

import express from "express";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// ----------------------------
// Paths / storage
// ----------------------------
const DATA_DIR = path.join(__dirname, "data");
const EVENTS_DIR = path.join(DATA_DIR, "events");
const CONFIG_DIR = path.join(DATA_DIR, "config");

const SIGNALS_JSONL = path.join(EVENTS_DIR, "monetisation-signals.jsonl");
const WEIGHTS_JSON = path.join(CONFIG_DIR, "monetisation-weights.json");

// ----------------------------
// Defaults
// ----------------------------
const DEFAULT_WEIGHTS = {
  version: 1,
  updatedAt: new Date().toISOString(),
  eventWeights: {
    track_purchase: 8,
    album_purchase: 18,
    subscription_start: 20,
    subscription_renew: 10,
    subscription_cancel: -6,
    tip: 6,
    gift: 10,
    merch_purchase: 12,
    voucher_redeem: 5,
    refund: -12
  },
  spendMultipliers: {
    multiplier: 4
  },
  loyalty: {
    repeatBuyerBonus: 8,
    streakBonusPerWeek: 2,
    maxStreakWeeksCounted: 12
  },
  decay: {
    halfLifeDays: 21,
    maxLookbackDays: 120
  },
  limits: {
    maxBodyBytes: 25_000,
    maxLineScan: 150_000,
    maxReadBytes: 25 * 1024 * 1024
  }
};

// ----------------------------
// Simple in-memory rate limiter
// ----------------------------
const RATE = { windowMs: 30_000, max: 120 };
const rateBuckets = new Map();

function rateLimit(req, res, next) {
  const key =
    (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
    req.ip ||
    "unknown";
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

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

async function ensureDirs() {
  await fsp.mkdir(EVENTS_DIR, { recursive: true });
  await fsp.mkdir(CONFIG_DIR, { recursive: true });
}

async function readWeights() {
  await ensureDirs();
  try {
    const raw = await fsp.readFile(WEIGHTS_JSON, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.eventWeights) throw new Error("bad_weights");
    return parsed;
  } catch {
    await fsp.writeFile(WEIGHTS_JSON, JSON.stringify(DEFAULT_WEIGHTS, null, 2), "utf8");
    return DEFAULT_WEIGHTS;
  }
}

async function writeWeights(nextWeights) {
  await ensureDirs();
  const payload = { ...nextWeights, updatedAt: nowIso() };
  await fsp.writeFile(WEIGHTS_JSON, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

function parseMoneyAmountMinor(amountMinor) {
  const n = Number(amountMinor);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

function eventIdFor(evt) {
  const base = [
    evt.type,
    evt.artistId || "",
    evt.fanId || "",
    evt.trackId || "",
    evt.albumId || "",
    evt.amountMinor || "",
    evt.currency || "",
    evt.ts || ""
  ].join("|");
  return sha256(base).slice(0, 24);
}

function normalizeEvent(body) {
  const ts = body.ts ? new Date(body.ts) : new Date();
  const tsIso = isNaN(ts.getTime()) ? new Date() : ts;

  const evt = {
    type: (body.type || "").toString().trim(),
    ts: tsIso.toISOString(),
    artistId: (body.artistId || "").toString().trim(),
    fanId: (body.fanId || "").toString().trim(),
    trackId: (body.trackId || "").toString().trim(),
    albumId: (body.albumId || "").toString().trim(),
    amountMinor: parseMoneyAmountMinor(body.amountMinor),
    currency: (body.currency || "").toString().trim().toUpperCase() || "GBP",
    source: (body.source || "ui").toString().trim(),
    ref: (body.ref || "").toString().trim(),
    meta: typeof body.meta === "object" && body.meta ? body.meta : {}
  };

  evt.id = (body.id || "").toString().trim() || eventIdFor(evt);
  return evt;
}

function validateEvent(evt) {
  const allowedTypes = new Set([
    "track_purchase",
    "album_purchase",
    "subscription_start",
    "subscription_renew",
    "subscription_cancel",
    "tip",
    "gift",
    "merch_purchase",
    "voucher_redeem",
    "refund"
  ]);

  if (!evt.type || !allowedTypes.has(evt.type)) {
    return { ok: false, message: "Invalid or missing 'type'." };
  }
  if (!evt.artistId) return { ok: false, message: "Missing 'artistId'." };

  const fanRequired = new Set([
    "track_purchase",
    "album_purchase",
    "subscription_start",
    "subscription_renew",
    "subscription_cancel",
    "tip",
    "gift",
    "merch_purchase",
    "voucher_redeem",
    "refund"
  ]);
  if (fanRequired.has(evt.type) && !evt.fanId) {
    return { ok: false, message: "Missing 'fanId'." };
  }

  const moneyish = new Set([
    "track_purchase",
    "album_purchase",
    "subscription_start",
    "subscription_renew",
    "tip",
    "gift",
    "merch_purchase",
    "voucher_redeem",
    "refund"
  ]);

  if (moneyish.has(evt.type)) {
    if (!Number.isFinite(evt.amountMinor)) return { ok: false, message: "Invalid 'amountMinor'." };
    if (evt.type !== "refund" && evt.amountMinor < 0) {
      return { ok: false, message: "'amountMinor' must be >= 0." };
    }
    if (evt.type === "refund" && evt.amountMinor > 0) {
      evt.amountMinor = -Math.abs(evt.amountMinor);
    }
  }

  if (evt.type === "track_purchase" && !evt.trackId) {
    return { ok: false, message: "Missing 'trackId' for track_purchase." };
  }
  if (evt.type === "album_purchase" && !evt.albumId) {
    return { ok: false, message: "Missing 'albumId' for album_purchase." };
  }

  try {
    const metaBytes = Buffer.byteLength(JSON.stringify(evt.meta || {}), "utf8");
    if (metaBytes > 6000) return { ok: false, message: "'meta' too large." };
  } catch {
    return { ok: false, message: "Invalid 'meta'." };
  }

  return { ok: true };
}

async function appendJsonl(filePath, obj) {
  await ensureDirs();
  const line = JSON.stringify(obj);
  await fsp.appendFile(filePath, line + "\n", "utf8");
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

function decayFactor(eventTsIso, halfLifeDays) {
  const t = new Date(eventTsIso).getTime();
  if (!Number.isFinite(t)) return 1;
  const ageMs = Date.now() - t;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 0) return 1;
  const halfLife = Math.max(1, Number(halfLifeDays) || 21);
  return Math.pow(0.5, ageDays / halfLife);
}

function withinLookback(eventTsIso, maxLookbackDays) {
  const t = new Date(eventTsIso).getTime();
  if (!Number.isFinite(t)) return false;
  const ageMs = Date.now() - t;
  const maxMs = Math.max(1, Number(maxLookbackDays) || 120) * 24 * 60 * 60 * 1000;
  return ageMs <= maxMs;
}

function computeEventScore(evt, weights) {
  const base = Number(weights.eventWeights?.[evt.type] ?? 0) || 0;
  const halfLifeDays = Number(weights.decay?.halfLifeDays ?? 21) || 21;
  const df = decayFactor(evt.ts, halfLifeDays);

  const amountMajor = (Number(evt.amountMinor) || 0) / 100;
  const moneyBoost =
    Math.log1p(Math.abs(amountMajor)) *
    (Number(weights.spendMultipliers?.multiplier ?? 4) || 4);

  const moneySigned = evt.type === "refund" ? -Math.abs(moneyBoost) : moneyBoost;

  const moneyish = new Set([
    "track_purchase",
    "album_purchase",
    "subscription_start",
    "subscription_renew",
    "tip",
    "gift",
    "merch_purchase",
    "voucher_redeem",
    "refund"
  ]);

  const total = (base + (moneyish.has(evt.type) ? moneySigned : 0)) * df;
  return total;
}

function initArtistAgg() {
  return {
    artistId: "",
    lookbackDays: 0,
    totals: { events: 0, uniqueFans: 0, totalAmountMinor: 0, score: 0 },
    byType: {},
    topFans: [],
    updatedAt: nowIso()
  };
}

function pushTopFan(list, fanId, amountMinor, score, max = 8) {
  const existing = list.find((x) => x.fanId === fanId);
  if (existing) {
    existing.amountMinor += amountMinor;
    existing.score += score;
  } else {
    list.push({ fanId, amountMinor, score });
  }
  list.sort((a, b) => b.score - a.score);
  if (list.length > max) list.length = max;
}

// ----------------------------
// Admin auth (simple MVP)
// ----------------------------
function isAdmin(req) {
  const token = (req.headers["x-admin-token"] || "").toString().trim();
  const expected = process.env.ADMIN_TOKEN ? process.env.ADMIN_TOKEN.toString().trim() : "";
  if (!expected) return true;
  return token && token === expected;
}

// ----------------------------
// Middleware
// ----------------------------
router.use(rateLimit);

// ----------------------------
// Routes
// ----------------------------

router.get("/weights", async (req, res) => {
  const weights = await readWeights();
  return res.json({ success: true, weights });
});

router.put("/weights", async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(401).json({ success: false, error: "unauthorized" });
  }

  const incoming = req.body || {};
  const current = await readWeights();

  const next = {
    ...current,
    ...incoming,
    eventWeights: { ...current.eventWeights, ...(incoming.eventWeights || {}) },
    spendMultipliers: { ...current.spendMultipliers, ...(incoming.spendMultipliers || {}) },
    loyalty: { ...current.loyalty, ...(incoming.loyalty || {}) },
    decay: { ...current.decay, ...(incoming.decay || {}) },
    limits: { ...current.limits, ...(incoming.limits || {}) }
  };

  next.decay.halfLifeDays = clamp(Number(next.decay.halfLifeDays) || 21, 1, 365);
  next.decay.maxLookbackDays = clamp(Number(next.decay.maxLookbackDays) || 120, 7, 365);
  next.spendMultipliers.multiplier = clamp(Number(next.spendMultipliers.multiplier) || 4, 0, 50);

  const saved = await writeWeights(next);
  return res.json({ success: true, weights: saved });
});

router.post("/signals", async (req, res) => {
  try {
    const bytes = Buffer.byteLength(JSON.stringify(req.body || {}), "utf8");
    const weights = await readWeights();
    const maxBody =
      Number(weights.limits?.maxBodyBytes ?? DEFAULT_WEIGHTS.limits.maxBodyBytes) ||
      DEFAULT_WEIGHTS.limits.maxBodyBytes;

    if (bytes > maxBody) {
      return res.status(413).json({ success: false, error: "payload_too_large" });
    }
  } catch {
    return res.status(400).json({ success: false, error: "invalid_body" });
  }

  const evt = normalizeEvent(req.body || {});
  const v = validateEvent(evt);
  if (!v.ok) {
    return res.status(400).json({ success: false, error: "validation_error", message: v.message });
  }

  if (evt.type === "refund") {
    evt.amountMinor = -Math.abs(evt.amountMinor || 0);
  }

  await appendJsonl(SIGNALS_JSONL, evt);

  return res.json({
    success: true,
    message: "Signal recorded.",
    id: evt.id,
    type: evt.type,
    artistId: evt.artistId,
    fanId: evt.fanId || null,
    ts: evt.ts
  });
});

router.get("/artist/:artistId", async (req, res) => {
  const artistId = (req.params.artistId || "").toString().trim();
  if (!artistId) return res.status(400).json({ success: false, error: "missing_artistId" });

  const weights = await readWeights();
  const lookbackDays = clamp(
    Number(req.query.days) || Number(weights.decay?.maxLookbackDays ?? 120) || 120,
    1,
    365
  );

  const lines = await safeReadJsonlLines(
    SIGNALS_JSONL,
    Number(weights.limits?.maxReadBytes ?? DEFAULT_WEIGHTS.limits.maxReadBytes) ||
      DEFAULT_WEIGHTS.limits.maxReadBytes
  );

  const maxLines =
    Number(weights.limits?.maxLineScan ?? DEFAULT_WEIGHTS.limits.maxLineScan) ||
    DEFAULT_WEIGHTS.limits.maxLineScan;

  const agg = initArtistAgg();
  agg.artistId = artistId;
  agg.lookbackDays = lookbackDays;

  const fanSet = new Set();
  let scanned = 0;

  for (let i = lines.length - 1; i >= 0; i--) {
    scanned += 1;
    if (scanned > maxLines) break;

    const evt = safeJsonParse(lines[i]);
    if (!evt || evt.artistId !== artistId) continue;
    if (!withinLookback(evt.ts, lookbackDays)) continue;

    const s = computeEventScore(evt, weights);
    const amt = Number(evt.amountMinor) || 0;

    agg.totals.events += 1;
    agg.totals.totalAmountMinor += amt;
    agg.totals.score += s;

    if (evt.fanId) fanSet.add(evt.fanId);

    agg.byType[evt.type] = agg.byType[evt.type] || { events: 0, score: 0, totalAmountMinor: 0 };
    agg.byType[evt.type].events += 1;
    agg.byType[evt.type].score += s;
    agg.byType[evt.type].totalAmountMinor += amt;

    if (evt.fanId) pushTopFan(agg.topFans, evt.fanId, amt, s, 8);
  }

  agg.totals.uniqueFans = fanSet.size;

  const repeatBonus = Number(weights.loyalty?.repeatBuyerBonus ?? 8) || 8;
  let repeatBuyers = 0;
  for (const f of agg.topFans) {
    if (Math.abs(f.amountMinor) >= 200 && f.score >= 10) repeatBuyers += 1;
  }
  const loyaltyBoost = Math.min(repeatBuyers, 10) * repeatBonus;
  agg.totals.score += loyaltyBoost;

  agg.updatedAt = nowIso();

  return res.json({
    success: true,
    artist: agg,
    debug: { scannedLines: scanned, loyaltyBoost }
  });
});

router.get("/fan/:fanId", async (req, res) => {
  const fanId = (req.params.fanId || "").toString().trim();
  if (!fanId) return res.status(400).json({ success: false, error: "missing_fanId" });

  const weights = await readWeights();
  const lookbackDays = clamp(
    Number(req.query.days) || Number(weights.decay?.maxLookbackDays ?? 120) || 120,
    1,
    365
  );

  const lines = await safeReadJsonlLines(
    SIGNALS_JSONL,
    Number(weights.limits?.maxReadBytes ?? DEFAULT_WEIGHTS.limits.maxReadBytes) ||
      DEFAULT_WEIGHTS.limits.maxReadBytes
  );

  const maxLines =
    Number(weights.limits?.maxLineScan ?? DEFAULT_WEIGHTS.limits.maxLineScan) ||
    DEFAULT_WEIGHTS.limits.maxLineScan;

  const agg = {
    fanId,
    totals: { events: 0, uniqueArtists: 0, totalAmountMinor: 0 },
    byType: {},
    byArtist: {},
    updatedAt: nowIso()
  };

  const artistSet = new Set();
  let scanned = 0;

  for (let i = lines.length - 1; i >= 0; i--) {
    scanned += 1;
    if (scanned > maxLines) break;

    const evt = safeJsonParse(lines[i]);
    if (!evt || evt.fanId !== fanId) continue;
    if (!withinLookback(evt.ts, lookbackDays)) continue;

    const amt = Number(evt.amountMinor) || 0;

    agg.totals.events += 1;
    agg.totals.totalAmountMinor += amt;

    if (evt.artistId) {
      artistSet.add(evt.artistId);
      agg.byArtist[evt.artistId] = agg.byArtist[evt.artistId] || { events: 0, totalAmountMinor: 0 };
      agg.byArtist[evt.artistId].events += 1;
      agg.byArtist[evt.artistId].totalAmountMinor += amt;
    }

    agg.byType[evt.type] = agg.byType[evt.type] || { events: 0, totalAmountMinor: 0 };
    agg.byType[evt.type].events += 1;
    agg.byType[evt.type].totalAmountMinor += amt;
  }

  agg.totals.uniqueArtists = artistSet.size;
  agg.updatedAt = nowIso();

  return res.json({
    success: true,
    fan: agg,
    debug: { scannedLines: scanned, lookbackDays }
  });
});

router.get("/score/:artistId", async (req, res) => {
  const artistId = (req.params.artistId || "").toString().trim();
  const fanId = (req.query.fanId || "").toString().trim();
  if (!artistId) return res.status(400).json({ success: false, error: "missing_artistId" });

  const weights = await readWeights();
  const lookbackDays = clamp(
    Number(req.query.days) || Number(weights.decay?.maxLookbackDays ?? 120) || 120,
    1,
    365
  );

  const lines = await safeReadJsonlLines(
    SIGNALS_JSONL,
    Number(weights.limits?.maxReadBytes ?? DEFAULT_WEIGHTS.limits.maxReadBytes) ||
      DEFAULT_WEIGHTS.limits.maxReadBytes
  );

  const maxLines =
    Number(weights.limits?.maxLineScan ?? DEFAULT_WEIGHTS.limits.maxLineScan) ||
    DEFAULT_WEIGHTS.limits.maxLineScan;

  let scanned = 0;
  let score = 0;
  let totalAmountMinor = 0;
  let events = 0;
  const uniqueFans = new Set();

  let fanAffinity = 0;
  let fanAmountMinor = 0;
  let fanEvents = 0;

  for (let i = lines.length - 1; i >= 0; i--) {
    scanned += 1;
    if (scanned > maxLines) break;

    const evt = safeJsonParse(lines[i]);
    if (!evt || evt.artistId !== artistId) continue;
    if (!withinLookback(evt.ts, lookbackDays)) continue;

    const s = computeEventScore(evt, weights);
    const amt = Number(evt.amountMinor) || 0;

    score += s;
    totalAmountMinor += amt;
    events += 1;

    if (evt.fanId) uniqueFans.add(evt.fanId);

    if (fanId && evt.fanId === fanId) {
      fanAffinity += s;
      fanAmountMinor += amt;
      fanEvents += 1;
    }
  }

  const normalized = clamp(Math.round(score), -50, 250);
  const monetisationScore = clamp(normalized, 0, 100);

  const fanAffinityNorm = clamp(Math.round(fanAffinity), -20, 120);
  const fanAffinityScore = clamp(fanAffinityNorm, 0, 100);

  return res.json({
    success: true,
    artistId,
    lookbackDays,
    monetisation: {
      monetisationScore,
      rawScore: score,
      events,
      uniqueFans: uniqueFans.size,
      totalAmountMinor
    },
    fan: fanId
      ? {
          fanId,
          fanAffinityScore,
          rawAffinity: fanAffinity,
          fanEvents,
          fanAmountMinor
        }
      : null,
    updatedAt: nowIso(),
    debug: { scannedLines: scanned }
  });
});

router.get("/health", async (req, res) => {
  await ensureDirs();
  const weights = await readWeights();
  const exists = fs.existsSync(SIGNALS_JSONL);
  return res.json({
    success: true,
    service: "monetisation",
    eventsFileExists: exists,
    weightsVersion: weights.version || 1,
    ts: nowIso()
  });
});

export default router;