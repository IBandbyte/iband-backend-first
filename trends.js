/**
 * trends.js (Phase H4) - ESM
 * --------------------------
 * Trend Engine (Foundation)
 *
 * Reads share attribution events from persistent Render disk:
 *   /var/data/iband/db/shares/events/shares.jsonl
 *
 * Produces:
 * - Trend Starter (earliest referrerFanId for a track within lookback)
 * - Podium (top referrers by share count)
 * - Trend score (recency-weighted share influence)
 *
 * Endpoints:
 * - GET /api/trends/health
 * - GET /api/trends/track/:artistId/:trackId?days=120&podium=10
 * - GET /api/trends/artist/:artistId?days=120&podium=10
 *
 * Notes:
 * - This is share-driven trending for now.
 * - Future: join purchases/signals by ref/referrerFanId for "conversion podium".
 */

import express from "express";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";

const router = express.Router();

// ----------------------------
// Persistent storage
// ----------------------------
const DATA_DIR = process.env.IBAND_DATA_DIR || "/var/data/iband/db";
const SHARES_DIR = path.join(DATA_DIR, "shares");
const EVENTS_DIR = path.join(SHARES_DIR, "events");
const SHARES_JSONL = path.join(EVENTS_DIR, "shares.jsonl");

// ----------------------------
// Limits / tuning
// ----------------------------
const LIMITS = {
  maxReadBytes: 20 * 1024 * 1024,
  maxLineScan: 160_000
};

const TREND = {
  // how fast trend score decays over time (shares from yesterday matter more than last month)
  halfLifeDays: 10
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
  await fsp.mkdir(EVENTS_DIR, { recursive: true });
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
  // share-based trend score normalized for UI (0-100)
  const v = Math.max(0, Number(raw) || 0);
  // soft cap curve
  const scaled = 100 * (1 - Math.exp(-v / 12));
  return clamp(Math.round(scaled), 0, 100);
}

function sortPodium(map) {
  return Array.from(map.entries())
    .map(([fanId, row]) => ({ fanId, ...row }))
    .sort((a, b) => b.shares - a.shares || b.rawTrend - a.rawTrend);
}

// ----------------------------
// Trend builders
// ----------------------------
async function buildTrackTrend({ artistId, trackId, days, podiumSize }) {
  const lb = clamp(Number(days) || 120, 1, 365);
  const podium = clamp(Number(podiumSize) || 10, 1, 50);

  const lines = await safeReadJsonlLines(SHARES_JSONL, LIMITS.maxReadBytes);

  let scanned = 0;
  let shares = 0;

  // earliest share = trend starter (within lookback)
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

    // trend starter logic (earliest share in lookback)
    const t = new Date(evt.ts).getTime();
    if (Number.isFinite(t)) {
      if (earliestTs === null || t < earliestTs) {
        earliestTs = t;
        trendStarterFanId = fanId;
      }
    }

    const df = decayFactor(evt.ts, TREND.halfLifeDays);

    const row = byFan.get(fanId) || {
      shares: 0,
      rawTrend: 0,
      firstTs: evt.ts,
      lastTs: evt.ts
    };

    row.shares += 1;
    row.rawTrend += df;

    // first/last timestamps
    if (new Date(evt.ts).getTime() < new Date(row.firstTs).getTime()) row.firstTs = evt.ts;
    if (new Date(evt.ts).getTime() > new Date(row.lastTs).getTime()) row.lastTs = evt.ts;

    byFan.set(fanId, row);
  }

  const podiumRows = sortPodium(byFan).slice(0, podium);
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

async function buildArtistTrend({ artistId, days, podiumSize }) {
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

    const df = decayFactor(evt.ts, TREND.halfLifeDays);

    const row = byFan.get(fanId) || {
      shares: 0,
      rawTrend: 0,
      firstTs: evt.ts,
      lastTs: evt.ts
    };

    row.shares += 1;
    row.rawTrend += df;

    if (new Date(evt.ts).getTime() < new Date(row.firstTs).getTime()) row.firstTs = evt.ts;
    if (new Date(evt.ts).getTime() > new Date(row.lastTs).getTime()) row.lastTs = evt.ts;

    byFan.set(fanId, row);
  }

  const podiumRows = sortPodium(byFan).slice(0, podium);
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
    service: "trends",
    phase: "H4",
    inputs: {
      sharesFile: {
        path: SHARES_JSONL,
        ok: !!stat,
        size: stat ? stat.size : 0,
        mtimeMs: stat ? stat.mtimeMs : null
      }
    },
    limits: LIMITS,
    tuning: TREND,
    ts: nowIso()
  });
});

router.get("/track/:artistId/:trackId", async (req, res) => {
  const artistId = (req.params.artistId || "").toString().trim();
  const trackId = (req.params.trackId || "").toString().trim();

  if (!artistId) return res.status(400).json({ success: false, error: "missing_artistId" });
  if (!trackId) return res.status(400).json({ success: false, error: "missing_trackId" });

  const days = clamp(Number(req.query.days) || 120, 1, 365);
  const podium = clamp(Number(req.query.podium) || 10, 1, 50);

  const out = await buildTrackTrend({ artistId, trackId, days, podiumSize: podium });
  return res.json({ success: true, ...out });
});

router.get("/artist/:artistId", async (req, res) => {
  const artistId = (req.params.artistId || "").toString().trim();
  if (!artistId) return res.status(400).json({ success: false, error: "missing_artistId" });

  const days = clamp(Number(req.query.days) || 120, 1, 365);
  const podium = clamp(Number(req.query.podium) || 10, 1, 50);

  const out = await buildArtistTrend({ artistId, days, podiumSize: podium });
  return res.json({ success: true, ...out });
});

export default router;