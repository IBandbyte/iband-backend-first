/**
 * trends.js (Phase H4) - ESM
 * --------------------------
 * Trend Engine:
 * - Share Trend: trend starter + share podium (already working)
 * - Conversion Trend (H4.2): join shares -> monetisation signals via "ref"
 *
 * Inputs (persistent Render disk):
 * - Shares JSONL:
 *   /var/data/iband/db/shares/events/shares.jsonl
 * - Monetisation signals JSONL:
 *   /var/data/iband/db/monetisation/events/monetisation-signals.jsonl
 *
 * Endpoints:
 * - GET /api/trends/health
 * - GET /api/trends/track/:artistId/:trackId?days=120&podium=10
 * - GET /api/trends/artist/:artistId?days=120&podium=10
 *
 * - GET /api/trends/conversion/health
 * - GET /api/trends/conversion/track/:artistId/:trackId?days=120&podium=10
 * - GET /api/trends/conversion/artist/:artistId?days=120&podium=10
 *
 * Notes:
 * - Conversion join key: "ref" string must be present in both share event and purchase signal.
 * - This stays legal and safe: no payouts; just recognition + podium logic.
 */

import express from "express";
import fsp from "fs/promises";
import path from "path";

const router = express.Router();

// ----------------------------
// Persistent storage
// ----------------------------
const DATA_DIR = process.env.IBAND_DATA_DIR || "/var/data/iband/db";

// shares
const SHARES_DIR = path.join(DATA_DIR, "shares");
const SHARES_EVENTS_DIR = path.join(SHARES_DIR, "events");
const SHARES_JSONL = path.join(SHARES_EVENTS_DIR, "shares.jsonl");

// monetisation signals
const MON_DIR = path.join(DATA_DIR, "monetisation");
const MON_EVENTS_DIR = path.join(MON_DIR, "events");
const MON_JSONL = path.join(MON_EVENTS_DIR, "monetisation-signals.jsonl");

// ----------------------------
// Limits / tuning
// ----------------------------
const LIMITS = {
  maxReadBytes: 20 * 1024 * 1024,
  maxLineScan: 180_000
};

const TREND = {
  shareHalfLifeDays: 10,
  conversionHalfLifeDays: 14
};

// ----------------------------
// Helpers
// ----------------------------
function nowIso() {
  return new Date().toISOString();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

async function ensureDirs() {
  await fsp.mkdir(SHARES_EVENTS_DIR, { recursive: true });
  await fsp.mkdir(MON_EVENTS_DIR, { recursive: true });
}

function safeJsonParse(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
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

function decayFactor(tsIso, halfLifeDays) {
  const t = new Date(tsIso).getTime();
  if (!Number.isFinite(t)) return 1;
  const ageMs = Date.now() - t;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 0) return 1;
  const h = clamp(Number(halfLifeDays) || 10, 1, 365);
  return Math.pow(0.5, ageDays / h);
}

function normalizeScore(raw) {
  // normalized 0-100 for UI (soft cap)
  const v = Math.max(0, Number(raw) || 0);
  const scaled = 100 * (1 - Math.exp(-v / 12));
  return clamp(Math.round(scaled), 0, 100);
}

function sortPodium(map, primaryKey = "shares") {
  return Array.from(map.entries())
    .map(([fanId, row]) => ({ fanId, ...row }))
    .sort((a, b) => {
      const p = (Number(b[primaryKey]) || 0) - (Number(a[primaryKey]) || 0);
      if (p !== 0) return p;
      return (Number(b.rawTrend) || 0) - (Number(a.rawTrend) || 0);
    });
}

function pickRef(evt) {
  // compatible with multiple formats
  if (evt && typeof evt.ref === "string" && evt.ref.trim()) return evt.ref.trim();
  if (evt && evt.meta && typeof evt.meta.ref === "string" && evt.meta.ref.trim()) return evt.meta.ref.trim();
  if (evt && typeof evt.shareRef === "string" && evt.shareRef.trim()) return evt.shareRef.trim();
  if (evt && evt.meta && typeof evt.meta.shareRef === "string" && evt.meta.shareRef.trim()) return evt.meta.shareRef.trim();
  return "";
}

function pickFanId(evt) {
  // buyer fan id (signals)
  return (evt?.fanId || evt?.buyerFanId || evt?.userId || "").toString().trim();
}

function isPurchaseType(type) {
  const t = (type || "").toString().trim().toLowerCase();
  return t === "track_purchase" || t === "album_purchase" || t === "subscription_start" || t === "subscription_renew";
}

// ----------------------------
// Share trend builders (existing)
// ----------------------------
async function buildTrackShareTrend({ artistId, trackId, days, podiumSize }) {
  const lb = clamp(Number(days) || 120, 1, 365);
  const podium = clamp(Number(podiumSize) || 10, 1, 50);

  const lines = await safeReadJsonlLines(SHARES_JSONL, LIMITS.maxReadBytes);

  let scanned = 0;
  let shares = 0;

  let earliestTs = null;
  let trendStarterFanId = null;

  const byFan = new Map(); // fanId -> {shares, rawTrend, firstTs, lastTs}

  for (let i = lines.length - 1; i >= 0; i--) {
    scanned += 1;
    if (scanned > LIMITS.maxLineScan) break;

    const evt = safeJsonParse(lines[i]);
    if (!evt || evt.type !== "share") continue;
    if (evt.artistId !== artistId) continue;
    if (evt.assetType !== "track") continue;
    if (evt.trackId !== trackId) continue;
    if (!withinLookback(evt.ts, lb)) continue;

    shares += 1;

    const fanId = (evt.referrerFanId || "").toString().trim();
    if (!fanId) continue;

    const t = new Date(evt.ts).getTime();
    if (Number.isFinite(t)) {
      if (earliestTs === null || t < earliestTs) {
        earliestTs = t;
        trendStarterFanId = fanId;
      }
    }

    const df = decayFactor(evt.ts, TREND.shareHalfLifeDays);

    const row = byFan.get(fanId) || { shares: 0, rawTrend: 0, firstTs: evt.ts, lastTs: evt.ts };
    row.shares += 1;
    row.rawTrend += df;

    if (new Date(evt.ts).getTime() < new Date(row.firstTs).getTime()) row.firstTs = evt.ts;
    if (new Date(evt.ts).getTime() > new Date(row.lastTs).getTime()) row.lastTs = evt.ts;

    byFan.set(fanId, row);
  }

  const podiumRows = sortPodium(byFan, "shares").slice(0, podium);
  const rawTrendScore = podiumRows.reduce((acc, r) => acc + (Number(r.rawTrend) || 0), 0);
  const trendScore = normalizeScore(rawTrendScore);

  return {
    artistId,
    trackId,
    days: lb,
    shares,
    trendStarterFanId: trendStarterFanId || null,
    trendScore,
    rawTrendScore,
    podium: podiumRows.map((r, idx) => ({
      rank: idx + 1,
      fanId: r.fanId,
      shares: r.shares,
      trendContribution: clamp(Number(r.rawTrend) || 0, 0, 1e9),
      firstTs: r.firstTs,
      lastTs: r.lastTs,
      badges: r.fanId === trendStarterFanId ? ["trend_starter"] : []
    })),
    updatedAt: nowIso(),
    debug: { scannedLines: scanned }
  };
}

async function buildArtistShareTrend({ artistId, days, podiumSize }) {
  const lb = clamp(Number(days) || 120, 1, 365);
  const podium = clamp(Number(podiumSize) || 10, 1, 50);

  const lines = await safeReadJsonlLines(SHARES_JSONL, LIMITS.maxReadBytes);

  let scanned = 0;
  let shares = 0;

  let earliestTs = null;
  let trendStarterFanId = null;

  const byFan = new Map(); // fanId -> {shares, rawTrend, firstTs, lastTs}

  for (let i = lines.length - 1; i >= 0; i--) {
    scanned += 1;
    if (scanned > LIMITS.maxLineScan) break;

    const evt = safeJsonParse(lines[i]);
    if (!evt || evt.type !== "share") continue;
    if (evt.artistId !== artistId) continue;
    if (!withinLookback(evt.ts, lb)) continue;

    shares += 1;

    const fanId = (evt.referrerFanId || "").toString().trim();
    if (!fanId) continue;

    const t = new Date(evt.ts).getTime();
    if (Number.isFinite(t)) {
      if (earliestTs === null || t < earliestTs) {
        earliestTs = t;
        trendStarterFanId = fanId;
      }
    }

    const df = decayFactor(evt.ts, TREND.shareHalfLifeDays);

    const row = byFan.get(fanId) || { shares: 0, rawTrend: 0, firstTs: evt.ts, lastTs: evt.ts };
    row.shares += 1;
    row.rawTrend += df;

    if (new Date(evt.ts).getTime() < new Date(row.firstTs).getTime()) row.firstTs = evt.ts;
    if (new Date(evt.ts).getTime() > new Date(evt.ts).getTime()) row.lastTs = evt.ts;

    byFan.set(fanId, row);
  }

  const podiumRows = sortPodium(byFan, "shares").slice(0, podium);
  const rawTrendScore = podiumRows.reduce((acc, r) => acc + (Number(r.rawTrend) || 0), 0);
  const trendScore = normalizeScore(rawTrendScore);

  return {
    artistId,
    days: lb,
    shares,
    trendStarterFanId: trendStarterFanId || null,
    trendScore,
    rawTrendScore,
    podium: podiumRows.map((r, idx) => ({
      rank: idx + 1,
      fanId: r.fanId,
      shares: r.shares,
      trendContribution: clamp(Number(r.rawTrend) || 0, 0, 1e9),
      firstTs: r.firstTs,
      lastTs: r.lastTs,
      badges: r.fanId === trendStarterFanId ? ["trend_starter"] : []
    })),
    updatedAt: nowIso(),
    debug: { scannedLines: scanned }
  };
}

// ----------------------------
// Conversion trend builders (H4.2)
// ----------------------------
async function buildRefToReferrerIndex({ artistId, trackId, days }) {
  // Build map: ref -> { referrerFanId, firstShareTs }
  const lb = clamp(Number(days) || 120, 1, 365);
  const lines = await safeReadJsonlLines(SHARES_JSONL, LIMITS.maxReadBytes);

  let scanned = 0;
  const refTo = new Map();

  for (let i = lines.length - 1; i >= 0; i--) {
    scanned += 1;
    if (scanned > LIMITS.maxLineScan) break;

    const evt = safeJsonParse(lines[i]);
    if (!evt || evt.type !== "share") continue;
    if (evt.artistId !== artistId) continue;
    if (!withinLookback(evt.ts, lb)) continue;

    if (trackId) {
      if (evt.assetType !== "track") continue;
      if (evt.trackId !== trackId) continue;
    }

    const ref = pickRef(evt);
    if (!ref) continue;

    const referrerFanId = (evt.referrerFanId || "").toString().trim();
    if (!referrerFanId) continue;

    // Keep earliest share for that ref as authoritative origin
    const cur = refTo.get(ref);
    if (!cur) {
      refTo.set(ref, { referrerFanId, firstShareTs: evt.ts });
      continue;
    }

    const curT = new Date(cur.firstShareTs).getTime();
    const newT = new Date(evt.ts).getTime();
    if (Number.isFinite(newT) && (!Number.isFinite(curT) || newT < curT)) {
      refTo.set(ref, { referrerFanId, firstShareTs: evt.ts });
    }
  }

  return { refTo, scannedShares: scanned };
}

async function buildTrackConversionTrend({ artistId, trackId, days, podiumSize }) {
  const lb = clamp(Number(days) || 120, 1, 365);
  const podium = clamp(Number(podiumSize) || 10, 1, 50);

  const { refTo, scannedShares } = await buildRefToReferrerIndex({ artistId, trackId, days: lb });
  const lines = await safeReadJsonlLines(MON_JSONL, LIMITS.maxReadBytes);

  let scannedMon = 0;

  let purchases = 0;
  let uniqueBuyers = new Set();
  let totalAmountMinor = 0;

  // earliest conversion event determines conversion starter
  let earliestConvTs = null;
  let conversionStarterFanId = null;

  const byReferrer = new Map(); // fanId -> { purchases, rawTrend, amountMinor, buyers:Set, firstTs, lastTs }

  for (let i = lines.length - 1; i >= 0; i--) {
    scannedMon += 1;
    if (scannedMon > LIMITS.maxLineScan) break;

    const evt = safeJsonParse(lines[i]);
    if (!evt) continue;
    if (!isPurchaseType(evt.type)) continue;
    if ((evt.artistId || "").toString().trim() !== artistId) continue;
    if (!withinLookback(evt.ts, lb)) continue;

    const ref = pickRef(evt);
    if (!ref) continue;

    const link = refTo.get(ref);
    if (!link) continue; // not attributable to a tracked share ref for this track

    const referrerFanId = link.referrerFanId;
    const buyerFanId = pickFanId(evt);
    const amt = Number(evt.amountMinor) || 0;

    purchases += 1;
    totalAmountMinor += amt;
    if (buyerFanId) uniqueBuyers.add(buyerFanId);

    const t = new Date(evt.ts).getTime();
    if (Number.isFinite(t)) {
      if (earliestConvTs === null || t < earliestConvTs) {
        earliestConvTs = t;
        conversionStarterFanId = referrerFanId;
      }
    }

    const df = decayFactor(evt.ts, TREND.conversionHalfLifeDays);

    const row = byReferrer.get(referrerFanId) || {
      purchases: 0,
      rawTrend: 0,
      amountMinor: 0,
      buyers: new Set(),
      firstTs: evt.ts,
      lastTs: evt.ts
    };

    row.purchases += 1;
    row.amountMinor += amt;
    row.rawTrend += df;

    if (buyerFanId) row.buyers.add(buyerFanId);

    if (new Date(evt.ts).getTime() < new Date(row.firstTs).getTime()) row.firstTs = evt.ts;
    if (new Date(evt.ts).getTime() > new Date(row.lastTs).getTime()) row.lastTs = evt.ts;

    byReferrer.set(referrerFanId, row);
  }

  const podiumRows = sortPodium(byReferrer, "purchases").slice(0, podium);
  const rawConversionScore = podiumRows.reduce((acc, r) => acc + (Number(r.rawTrend) || 0), 0);
  const conversionScore = normalizeScore(rawConversionScore);

  return {
    artistId,
    trackId,
    days: lb,
    purchases,
    uniqueBuyers: uniqueBuyers.size,
    totalAmountMinor,
    conversionStarterFanId: conversionStarterFanId || null,
    conversionScore,
    rawConversionScore,
    podium: podiumRows.map((r, idx) => ({
      rank: idx + 1,
      fanId: r.fanId,
      purchases: r.purchases,
      uniqueBuyers: r.buyers.size,
      amountMinor: r.amountMinor,
      trendContribution: clamp(Number(r.rawTrend) || 0, 0, 1e9),
      firstTs: r.firstTs,
      lastTs: r.lastTs,
      badges: r.fanId === conversionStarterFanId ? ["conversion_starter"] : []
    })),
    updatedAt: nowIso(),
    debug: { scannedSharesLines: scannedShares, scannedMonetisationLines: scannedMon, refsIndexed: refTo.size }
  };
}

async function buildArtistConversionTrend({ artistId, days, podiumSize }) {
  const lb = clamp(Number(days) || 120, 1, 365);
  const podium = clamp(Number(podiumSize) || 10, 1, 50);

  const { refTo, scannedShares } = await buildRefToReferrerIndex({ artistId, trackId: null, days: lb });
  const lines = await safeReadJsonlLines(MON_JSONL, LIMITS.maxReadBytes);

  let scannedMon = 0;

  let purchases = 0;
  let uniqueBuyers = new Set();
  let totalAmountMinor = 0;

  let earliestConvTs = null;
  let conversionStarterFanId = null;

  const byReferrer = new Map();

  for (let i = lines.length - 1; i >= 0; i--) {
    scannedMon += 1;
    if (scannedMon > LIMITS.maxLineScan) break;

    const evt = safeJsonParse(lines[i]);
    if (!evt) continue;
    if (!isPurchaseType(evt.type)) continue;
    if ((evt.artistId || "").toString().trim() !== artistId) continue;
    if (!withinLookback(evt.ts, lb)) continue;

    const ref = pickRef(evt);
    if (!ref) continue;

    const link = refTo.get(ref);
    if (!link) continue;

    const referrerFanId = link.referrerFanId;
    const buyerFanId = pickFanId(evt);
    const amt = Number(evt.amountMinor) || 0;

    purchases += 1;
    totalAmountMinor += amt;
    if (buyerFanId) uniqueBuyers.add(buyerFanId);

    const t = new Date(evt.ts).getTime();
    if (Number.isFinite(t)) {
      if (earliestConvTs === null || t < earliestConvTs) {
        earliestConvTs = t;
        conversionStarterFanId = referrerFanId;
      }
    }

    const df = decayFactor(evt.ts, TREND.conversionHalfLifeDays);

    const row = byReferrer.get(referrerFanId) || {
      purchases: 0,
      rawTrend: 0,
      amountMinor: 0,
      buyers: new Set(),
      firstTs: evt.ts,
      lastTs: evt.ts
    };

    row.purchases += 1;
    row.amountMinor += amt;
    row.rawTrend += df;

    if (buyerFanId) row.buyers.add(buyerFanId);

    if (new Date(evt.ts).getTime() < new Date(row.firstTs).getTime()) row.firstTs = evt.ts;
    if (new Date(evt.ts).getTime() > new Date(row.lastTs).getTime()) row.lastTs = evt.ts;

    byReferrer.set(referrerFanId, row);
  }

  const podiumRows = sortPodium(byReferrer, "purchases").slice(0, podium);
  const rawConversionScore = podiumRows.reduce((acc, r) => acc + (Number(r.rawTrend) || 0), 0);
  const conversionScore = normalizeScore(rawConversionScore);

  return {
    artistId,
    days: lb,
    purchases,
    uniqueBuyers: uniqueBuyers.size,
    totalAmountMinor,
    conversionStarterFanId: conversionStarterFanId || null,
    conversionScore,
    rawConversionScore,
    podium: podiumRows.map((r, idx) => ({
      rank: idx + 1,
      fanId: r.fanId,
      purchases: r.purchases,
      uniqueBuyers: r.buyers.size,
      amountMinor: r.amountMinor,
      trendContribution: clamp(Number(r.rawTrend) || 0, 0, 1e9),
      firstTs: r.firstTs,
      lastTs: r.lastTs,
      badges: r.fanId === conversionStarterFanId ? ["conversion_starter"] : []
    })),
    updatedAt: nowIso(),
    debug: { scannedSharesLines: scannedShares, scannedMonetisationLines: scannedMon, refsIndexed: refTo.size }
  };
}

// ----------------------------
// Routes
// ----------------------------
router.get("/health", async (req, res) => {
  await ensureDirs();

  let sharesStat = null;
  let monStat = null;

  try { sharesStat = await fsp.stat(SHARES_JSONL); } catch { sharesStat = null; }
  try { monStat = await fsp.stat(MON_JSONL); } catch { monStat = null; }

  return res.json({
    success: true,
    service: "trends",
    phase: "H4",
    inputs: {
      sharesFile: {
        path: SHARES_JSONL,
        ok: !!sharesStat,
        size: sharesStat ? sharesStat.size : 0,
        mtimeMs: sharesStat ? sharesStat.mtimeMs : null
      },
      monetisationFile: {
        path: MON_JSONL,
        ok: !!monStat,
        size: monStat ? monStat.size : 0,
        mtimeMs: monStat ? monStat.mtimeMs : null
      }
    },
    limits: LIMITS,
    tuning: TREND,
    ts: nowIso()
  });
});

// share trend endpoints
router.get("/track/:artistId/:trackId", async (req, res) => {
  const artistId = (req.params.artistId || "").toString().trim();
  const trackId = (req.params.trackId || "").toString().trim();

  if (!artistId) return res.status(400).json({ success: false, error: "missing_artistId" });
  if (!trackId) return res.status(400).json({ success: false, error: "missing_trackId" });

  const days = clamp(Number(req.query.days) || 120, 1, 365);
  const podium = clamp(Number(req.query.podium) || 10, 1, 50);

  const out = await buildTrackShareTrend({ artistId, trackId, days, podiumSize: podium });
  return res.json({ success: true, ...out });
});

router.get("/artist/:artistId", async (req, res) => {
  const artistId = (req.params.artistId || "").toString().trim();
  if (!artistId) return res.status(400).json({ success: false, error: "missing_artistId" });

  const days = clamp(Number(req.query.days) || 120, 1, 365);
  const podium = clamp(Number(req.query.podium) || 10, 1, 50);

  const out = await buildArtistShareTrend({ artistId, days, podiumSize: podium });
  return res.json({ success: true, ...out });
});

// conversion endpoints (H4.2)
router.get("/conversion/health", async (req, res) => {
  await ensureDirs();

  let sharesStat = null;
  let monStat = null;

  try { sharesStat = await fsp.stat(SHARES_JSONL); } catch { sharesStat = null; }
  try { monStat = await fsp.stat(MON_JSONL); } catch { monStat = null; }

  return res.json({
    success: true,
    service: "trends",
    phase: "H4.2",
    conversion: true,
    joinKey: "ref",
    inputs: {
      sharesFile: {
        path: SHARES_JSONL,
        ok: !!sharesStat,
        size: sharesStat ? sharesStat.size : 0,
        mtimeMs: sharesStat ? sharesStat.mtimeMs : null
      },
      monetisationFile: {
        path: MON_JSONL,
        ok: !!monStat,
        size: monStat ? monStat.size : 0,
        mtimeMs: monStat ? monStat.mtimeMs : null
      }
    },
    tuning: {
      conversionHalfLifeDays: TREND.conversionHalfLifeDays
    },
    limits: LIMITS,
    ts: nowIso()
  });
});

router.get("/conversion/track/:artistId/:trackId", async (req, res) => {
  const artistId = (req.params.artistId || "").toString().trim();
  const trackId = (req.params.trackId || "").toString().trim();

  if (!artistId) return res.status(400).json({ success: false, error: "missing_artistId" });
  if (!trackId) return res.status(400).json({ success: false, error: "missing_trackId" });

  const days = clamp(Number(req.query.days) || 120, 1, 365);
  const podium = clamp(Number(req.query.podium) || 10, 1, 50);

  const out = await buildTrackConversionTrend({ artistId, trackId, days, podiumSize: podium });
  return res.json({ success: true, ...out });
});

router.get("/conversion/artist/:artistId", async (req, res) => {
  const artistId = (req.params.artistId || "").toString().trim();
  if (!artistId) return res.status(400).json({ success: false, error: "missing_artistId" });

  const days = clamp(Number(req.query.days) || 120, 1, 365);
  const podium = clamp(Number(req.query.podium) || 10, 1, 50);

  const out = await buildArtistConversionTrend({ artistId, days, podiumSize: podium });
  return res.json({ success: true, ...out });
});

export default router;