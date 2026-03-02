/**
 * monetisationSignals.js (Phase H3) - ESM
 * --------------------------------------
 * IMPORTANT: Uses persistent Render disk:
 *   /var/data/iband/db/monetisation
 *
 * Records monetisation-related events into a JSONL stream and provides
 * aggregation endpoints + weights management.
 */

import express from "express";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";

const router = express.Router();

// ----------------------------
// Persistent storage base
// ----------------------------
const PERSIST_DIR = process.env.IBAND_DATA_DIR || "/var/data/iband/db";
const MON_DIR = path.join(PERSIST_DIR, "monetisation");
const EVENTS_DIR = path.join(MON_DIR, "events");
const CONFIG_DIR = path.join(MON_DIR, "config");

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
  spendMultipliers: { multiplier: 4 },
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
// Rate limiter (MVP)
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

  return (base + (moneyish.has(evt.type) ? moneySigned : 0)) * df;
}

function normalizeMonScore(rawScore) {
  const normalized = clamp(Math.round(rawScore), -50, 250);
  return clamp(normalized, 0, 100);
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

  if (evt.type === "refund") evt.amountMinor = -Math.abs(evt.amountMinor || 0);

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

  const maxBytes =
    Number(weights.limits?.maxReadBytes ?? DEFAULT_WEIGHTS.limits.maxReadBytes) ||
    DEFAULT_WEIGHTS.limits.maxReadBytes;

  const maxLines =
    Number(weights.limits?.maxLineScan ?? DEFAULT_WEIGHTS.limits.maxLineScan) ||
    DEFAULT_WEIGHTS.limits.maxLineScan;

  const lines = await safeReadJsonlLines(SIGNALS_JSONL, maxBytes);

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

  const monetisationScore = normalizeMonScore(score);
  const fanAffinityScore = normalizeMonScore(fanAffinity);

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
    debug: { scannedLines: scanned, storageDir: MON_DIR }
  });
});

router.get("/health", async (req, res) => {
  await ensureDirs();
  const weights = await readWeights();
  const exists = fs.existsSync(SIGNALS_JSONL);

  let stat = null;
  try {
    stat = await fsp.stat(SIGNALS_JSONL);
  } catch {
    stat = null;
  }

  return res.json({
    success: true,
    service: "monetisation",
    storageDir: MON_DIR,
    eventsFile: {
      path: SIGNALS_JSONL,
      ok: !!stat,
      size: stat ? stat.size : 0,
      mtimeMs: stat ? stat.mtimeMs : null
    },
    weightsVersion: weights.version || 1,
    ts: nowIso()
  });
});

export default router;