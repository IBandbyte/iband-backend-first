/**
 * monetisationSignals.js - ESM
 * ---------------------------------
 * Persistent monetisation signal ingestion for iBand.
 *
 * Storage (Render persistent disk):
 *   /var/data/iband/db/monetisation/events/monetisation-signals.jsonl
 *
 * Goals:
 * - Provide stable, future-proof POST endpoints for recording signals
 * - Preserve working health + weights endpoints
 * - Support "ref" field so shares -> purchases attribution is possible (H4.2)
 *
 * Endpoints:
 * - GET  /api/monetisation/health
 * - GET  /api/monetisation/weights
 *
 * - POST /api/monetisation
 * - POST /api/monetisation/signal
 * - POST /api/monetisation/record
 * - POST /api/monetisation/ingest
 */

import express from "express";
import crypto from "crypto";
import fsp from "fs/promises";
import path from "path";

const router = express.Router();

// ----------------------------
// Persistent storage
// ----------------------------
const DATA_DIR = process.env.IBAND_DATA_DIR || "/var/data/iband/db";
const MON_DIR = path.join(DATA_DIR, "monetisation");
const EVENTS_DIR = path.join(MON_DIR, "events");
const MON_JSONL = path.join(EVENTS_DIR, "monetisation-signals.jsonl");

// ----------------------------
// Limits
// ----------------------------
const LIMITS = {
  maxBodyBytes: 25_000,
  maxReadBytes: 25 * 1024 * 1024,
  maxLineScan: 150_000
};

// ----------------------------
// Weights (Versioned)
// NOTE: Keep aligned with your existing weights response you pasted.
// ----------------------------
const WEIGHTS = {
  version: 1,
  updatedAt: "2026-03-02T01:51:43.382Z",
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
    maxBodyBytes: LIMITS.maxBodyBytes,
    maxLineScan: LIMITS.maxLineScan,
    maxReadBytes: LIMITS.maxReadBytes
  }
};

// ----------------------------
// Helpers
// ----------------------------
function nowIso() {
  return new Date().toISOString();
}

async function ensureDirs() {
  await fsp.mkdir(EVENTS_DIR, { recursive: true });
}

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function safeJsonParse(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

async function appendJsonl(filePath, obj) {
  await ensureDirs();
  await fsp.appendFile(filePath, JSON.stringify(obj) + "\n", "utf8");
}

function normalizeSignal(body) {
  const ts = body.ts ? new Date(body.ts) : new Date();
  const tsIso = isNaN(ts.getTime()) ? new Date().toISOString() : ts.toISOString();

  const evt = {
    type: (body.type || "").toString().trim(),
    ts: tsIso,

    artistId: (body.artistId || "").toString().trim(),
    trackId: (body.trackId || "").toString().trim(),
    albumId: (body.albumId || "").toString().trim(),

    // buyer / actor
    fanId: (body.fanId || body.buyerFanId || body.userId || "").toString().trim(),

    // money
    amountMinor: Number.isFinite(Number(body.amountMinor)) ? Number(body.amountMinor) : 0,
    currency: (body.currency || "").toString().trim().toUpperCase(),

    // attribution join key for H4.2
    ref: (body.ref || (body.meta && body.meta.ref) || "").toString().trim(),

    // metadata
    meta: typeof body.meta === "object" && body.meta ? body.meta : {}
  };

  evt.id =
    (body.id || "").toString().trim() ||
    sha256(
      [
        evt.type,
        evt.artistId,
        evt.trackId,
        evt.albumId,
        evt.fanId,
        evt.amountMinor,
        evt.currency,
        evt.ref,
        evt.ts
      ].join("|")
    ).slice(0, 24);

  return evt;
}

function validateSignal(evt) {
  if (!evt.type) return { ok: false, message: "Missing 'type'." };
  if (!evt.artistId) return { ok: false, message: "Missing 'artistId'." };
  if (!evt.fanId) return { ok: false, message: "Missing 'fanId'." };

  // basic size guard for meta
  try {
    const metaBytes = Buffer.byteLength(JSON.stringify(evt.meta || {}), "utf8");
    if (metaBytes > 7000) return { ok: false, message: "'meta' too large." };
  } catch {
    return { ok: false, message: "Invalid 'meta'." };
  }

  // track_purchase should have trackId (future-proof validation but not overly strict)
  if (evt.type === "track_purchase" && !evt.trackId) {
    return { ok: false, message: "Missing 'trackId' for track_purchase." };
  }

  return { ok: true };
}

function bodyBytes(body) {
  try {
    return Buffer.byteLength(JSON.stringify(body || {}), "utf8");
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

// ----------------------------
// Routes
// ----------------------------
router.get("/health", async (req, res) => {
  await ensureDirs();

  let stat = null;
  try {
    stat = await fsp.stat(MON_JSONL);
  } catch {
    stat = null;
  }

  return res.json({
    success: true,
    service: "monetisation",
    storageDir: MON_DIR,
    eventsFile: {
      path: MON_JSONL,
      ok: !!stat,
      size: stat ? stat.size : 0,
      mtimeMs: stat ? stat.mtimeMs : null
    },
    weightsVersion: WEIGHTS.version,
    ts: nowIso()
  });
});

router.get("/weights", async (req, res) => {
  return res.json({
    success: true,
    weights: WEIGHTS
  });
});

async function handleRecord(req, res) {
  const bytes = bodyBytes(req.body);
  if (bytes > LIMITS.maxBodyBytes) {
    return res.status(413).json({ success: false, error: "payload_too_large" });
  }

  const evt = normalizeSignal(req.body || {});
  const v = validateSignal(evt);
  if (!v.ok) {
    return res.status(400).json({ success: false, error: "validation_error", message: v.message });
  }

  await appendJsonl(MON_JSONL, evt);

  return res.json({
    success: true,
    message: "Signal recorded.",
    id: evt.id,
    type: evt.type,
    artistId: evt.artistId,
    trackId: evt.trackId || null,
    albumId: evt.albumId || null,
    fanId: evt.fanId,
    amountMinor: evt.amountMinor,
    currency: evt.currency || null,
    ref: evt.ref || null,
    ts: evt.ts
  });
}

// Canonical + aliases (so we never get blocked by routing again)
router.post("/", handleRecord);
router.post("/signal", handleRecord);
router.post("/record", handleRecord);
router.post("/ingest", handleRecord);

export default router;