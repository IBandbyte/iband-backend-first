/**
 * ambassadors.js
 * ---------------------------------------
 * Phase H5 – Ambassador Qualification Engine (Production-grade)
 *
 * Determines if a fan qualifies as an Ambassador for an artist based on:
 * - trend_starter: earliest share for the artist in lookback window
 * - conversion_starter: earliest attributable purchase from a share-ref in lookback
 * - podium: top referrers by shares + top referrers by attributed purchases
 *
 * Data sources (Render persistent disk):
 * - /var/data/iband/db/shares/events/shares.jsonl
 * - /var/data/iband/db/monetisation/events/monetisation-signals.jsonl
 *
 * Endpoints:
 * - GET /api/ambassadors/health
 * - GET /api/ambassadors/artist/:artistId/fan/:fanId?days=120&podium=10
 * - GET /api/ambassadors/artist/:artistId/podium?days=120&podium=10
 * - GET /api/ambassadors/artist/:artistId/eligible?days=120&podium=10
 */

import express from "express";
import fsp from "fs/promises";
import path from "path";

const router = express.Router();

const DATA_DIR = process.env.IBAND_DATA_DIR || "/var/data/iband/db";

const SHARES_FILE = path.join(DATA_DIR, "shares", "events", "shares.jsonl");
const MON_FILE = path.join(DATA_DIR, "monetisation", "events", "monetisation-signals.jsonl");

const LIMITS = {
  maxReadBytes: 25 * 1024 * 1024,
  maxLineScan: 200000
};

function nowIso() {
  return new Date().toISOString();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function safeJson(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

async function readJsonl(filePath, maxBytes) {
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
  return ageMs <= days * 86400000;
}

function pickRef(evt) {
  if (evt && typeof evt.ref === "string" && evt.ref.trim()) return evt.ref.trim();
  if (evt && evt.meta && typeof evt.meta.ref === "string" && evt.meta.ref.trim()) return evt.meta.ref.trim();
  if (evt && typeof evt.shareRef === "string" && evt.shareRef.trim()) return evt.shareRef.trim();
  if (evt && evt.meta && typeof evt.meta.shareRef === "string" && evt.meta.shareRef.trim()) return evt.meta.shareRef.trim();
  return "";
}

function pickBuyerFanId(evt) {
  return (evt?.fanId || evt?.buyerFanId || evt?.userId || "").toString().trim();
}

function isPurchaseType(type) {
  const t = (type || "").toString().trim().toLowerCase();
  return t === "track_purchase" || t === "album_purchase" || t === "subscription_start" || t === "subscription_renew";
}

function sortMapToPodium(map, keyField) {
  return Array.from(map.entries())
    .map(([fanId, row]) => ({ fanId, ...row }))
    .sort((a, b) => (Number(b[keyField]) || 0) - (Number(a[keyField]) || 0));
}

function computeTier({
  fanId,
  trendStarterFanId,
  conversionStarterFanId,
  shareRank,
  conversionRank,
  shareCount,
  purchaseCount
}) {
  const badges = [];

  const isTrendStarter = fanId === trendStarterFanId && trendStarterFanId !== null;
  const isConversionStarter = fanId === conversionStarterFanId && conversionStarterFanId !== null;

  if (isTrendStarter) badges.push("trend_starter");
  if (isConversionStarter) badges.push("conversion_starter");

  if (shareRank && shareRank <= 3) badges.push("share_podium_top3");
  if (conversionRank && conversionRank <= 3) badges.push("conversion_podium_top3");

  // Tier rules:
  // - gold: conversion_starter OR conversion podium top3 OR purchases attributed >= 3
  // - silver: trend_starter OR share podium top3 OR shares >= 5
  // - bronze: shares >= 2 OR purchases attributed >= 1
  let tier = "none";

  if (isConversionStarter || (conversionRank && conversionRank <= 3) || purchaseCount >= 3) {
    tier = "gold";
  } else if (isTrendStarter || (shareRank && shareRank <= 3) || shareCount >= 5) {
    tier = "silver";
  } else if (shareCount >= 2 || purchaseCount >= 1) {
    tier = "bronze";
  }

  return { tier, badges, ambassador: tier !== "none" };
}

async function buildArtistAmbassadorState(artistId, days, podiumSize) {
  const shareLines = await readJsonl(SHARES_FILE, LIMITS.maxReadBytes);
  const monLines = await readJsonl(MON_FILE, LIMITS.maxReadBytes);

  // ----------------------------
  // Shares pass (artist)
  // ----------------------------
  let scannedShares = 0;

  let earliestShareTs = null;
  let trendStarterFanId = null;

  const sharesByFan = new Map(); // fanId -> { shares, firstTs, lastTs }
  const refTo = new Map(); // ref -> { referrerFanId, firstShareTs }

  for (let i = shareLines.length - 1; i >= 0; i--) {
    scannedShares += 1;
    if (scannedShares > LIMITS.maxLineScan) break;

    const evt = safeJson(shareLines[i]);
    if (!evt || evt.type !== "share") continue;
    if ((evt.artistId || "").toString().trim() !== artistId) continue;
    if (!withinLookback(evt.ts, days)) continue;

    const referrer = (evt.referrerFanId || "").toString().trim();
    if (!referrer) continue;

    const t = new Date(evt.ts).getTime();
    if (Number.isFinite(t)) {
      if (earliestShareTs === null || t < earliestShareTs) {
        earliestShareTs = t;
        trendStarterFanId = referrer;
      }
    }

    const row = sharesByFan.get(referrer) || { shares: 0, firstTs: evt.ts, lastTs: evt.ts };
    row.shares += 1;
    if (new Date(evt.ts).getTime() < new Date(row.firstTs).getTime()) row.firstTs = evt.ts;
    if (new Date(evt.ts).getTime() > new Date(row.lastTs).getTime()) row.lastTs = evt.ts;
    sharesByFan.set(referrer, row);

    const ref = pickRef(evt);
    if (ref) {
      const cur = refTo.get(ref);
      if (!cur) {
        refTo.set(ref, { referrerFanId: referrer, firstShareTs: evt.ts });
      } else {
        const curT = new Date(cur.firstShareTs).getTime();
        if (Number.isFinite(t) && (!Number.isFinite(curT) || t < curT)) {
          refTo.set(ref, { referrerFanId: referrer, firstShareTs: evt.ts });
        }
      }
    }
  }

  const sharePodium = sortMapToPodium(sharesByFan, "shares")
    .slice(0, podiumSize)
    .map((r, idx) => ({
      rank: idx + 1,
      fanId: r.fanId,
      shares: r.shares,
      firstTs: r.firstTs,
      lastTs: r.lastTs,
      badges: r.fanId === trendStarterFanId ? ["trend_starter"] : []
    }));

  const shareRankMap = new Map(sharePodium.map((p) => [p.fanId, p.rank]));

  // ----------------------------
  // Monetisation pass (attributed)
  // ----------------------------
  let scannedMon = 0;

  let earliestConversionTs = null;
  let conversionStarterFanId = null;

  const convByFan = new Map(); // fanId -> { purchases, amountMinor, buyers:Set, firstTs, lastTs }

  for (let i = monLines.length - 1; i >= 0; i--) {
    scannedMon += 1;
    if (scannedMon > LIMITS.maxLineScan) break;

    const evt = safeJson(monLines[i]);
    if (!evt) continue;
    if (!isPurchaseType(evt.type)) continue;
    if ((evt.artistId || "").toString().trim() !== artistId) continue;
    if (!withinLookback(evt.ts, days)) continue;

    const ref = pickRef(evt);
    if (!ref) continue;

    const link = refTo.get(ref);
    if (!link) continue;

    const creditedFanId = link.referrerFanId;
    const buyerId = pickBuyerFanId(evt);
    const amt = Number(evt.amountMinor) || 0;

    const t = new Date(evt.ts).getTime();
    if (Number.isFinite(t)) {
      if (earliestConversionTs === null || t < earliestConversionTs) {
        earliestConversionTs = t;
        conversionStarterFanId = creditedFanId;
      }
    }

    const row =
      convByFan.get(creditedFanId) || {
        purchases: 0,
        amountMinor: 0,
        buyers: new Set(),
        firstTs: evt.ts,
        lastTs: evt.ts
      };

    row.purchases += 1;
    row.amountMinor += amt;
    if (buyerId) row.buyers.add(buyerId);

    if (new Date(evt.ts).getTime() < new Date(row.firstTs).getTime()) row.firstTs = evt.ts;
    if (new Date(evt.ts).getTime() > new Date(row.lastTs).getTime()) row.lastTs = evt.ts;

    convByFan.set(creditedFanId, row);
  }

  const conversionPodium = sortMapToPodium(convByFan, "purchases")
    .slice(0, podiumSize)
    .map((r, idx) => ({
      rank: idx + 1,
      fanId: r.fanId,
      purchases: r.purchases,
      uniqueBuyers: r.buyers.size,
      amountMinor: r.amountMinor,
      firstTs: r.firstTs,
      lastTs: r.lastTs,
      badges: r.fanId === conversionStarterFanId ? ["conversion_starter"] : []
    }));

  const conversionRankMap = new Map(conversionPodium.map((p) => [p.fanId, p.rank]));

  // ----------------------------
  // Eligible list (union of top share + top conversion)
  // ----------------------------
  const eligibleFanIds = new Set([
    ...sharePodium.map((p) => p.fanId),
    ...conversionPodium.map((p) => p.fanId),
    ...(trendStarterFanId ? [trendStarterFanId] : []),
    ...(conversionStarterFanId ? [conversionStarterFanId] : [])
  ]);

  const eligible = Array.from(eligibleFanIds).map((fid) => {
    const shareRow = sharesByFan.get(fid) || { shares: 0 };
    const convRow = convByFan.get(fid) || { purchases: 0, amountMinor: 0, buyers: new Set() };

    const shareRank = shareRankMap.get(fid) || null;
    const conversionRank = conversionRankMap.get(fid) || null;

    const { tier, badges, ambassador } = computeTier({
      fanId: fid,
      trendStarterFanId,
      conversionStarterFanId,
      shareRank,
      conversionRank,
      shareCount: shareRow.shares || 0,
      purchaseCount: convRow.purchases || 0
    });

    return {
      fanId: fid,
      ambassador,
      tier,
      badges,
      shareCount: shareRow.shares || 0,
      shareRank,
      purchaseCount: convRow.purchases || 0,
      amountMinor: convRow.amountMinor || 0,
      uniqueBuyers: convRow.buyers ? convRow.buyers.size : 0,
      conversionRank
    };
  });

  // sort: gold > silver > bronze > none, then conversion rank, then share rank
  const tierOrder = { gold: 3, silver: 2, bronze: 1, none: 0 };
  eligible.sort((a, b) => {
    const t = (tierOrder[b.tier] || 0) - (tierOrder[a.tier] || 0);
    if (t !== 0) return t;
    const cr = (a.conversionRank || 999) - (b.conversionRank || 999);
    if (cr !== 0) return cr;
    const sr = (a.shareRank || 999) - (b.shareRank || 999);
    if (sr !== 0) return sr;
    return (b.purchaseCount || 0) - (a.purchaseCount || 0);
  });

  return {
    artistId,
    days,
    podiumSize,
    starters: {
      trendStarterFanId: trendStarterFanId || null,
      conversionStarterFanId: conversionStarterFanId || null
    },
    podium: {
      shares: sharePodium,
      conversions: conversionPodium
    },
    eligible,
    debug: {
      refsIndexed: refTo.size,
      scannedSharesLines: scannedShares,
      scannedMonetisationLines: scannedMon
    }
  };
}

router.get("/health", async (req, res) => {
  let sharesOk = false;
  let monOk = false;

  try {
    await fsp.stat(SHARES_FILE);
    sharesOk = true;
  } catch {
    sharesOk = false;
  }

  try {
    await fsp.stat(MON_FILE);
    monOk = true;
  } catch {
    monOk = false;
  }

  return res.json({
    success: true,
    service: "ambassadors",
    phase: "H5",
    storage: DATA_DIR,
    inputs: {
      sharesFile: { path: SHARES_FILE, ok: sharesOk },
      monetisationFile: { path: MON_FILE, ok: monOk }
    },
    ts: nowIso()
  });
});

// Fan-focused qualification
router.get("/artist/:artistId/fan/:fanId", async (req, res) => {
  const artistId = (req.params.artistId || "").toString().trim();
  const fanId = (req.params.fanId || "").toString().trim();
  if (!artistId || !fanId) return res.status(400).json({ success: false, error: "missing_params" });

  const days = clamp(Number(req.query.days) || 120, 1, 365);
  const podiumSize = clamp(Number(req.query.podium) || 10, 1, 50);

  const state = await buildArtistAmbassadorState(artistId, days, podiumSize);

  // derive fan-specific view from state
  const shareEntry = state.podium.shares.find((p) => p.fanId === fanId);
  const convEntry = state.podium.conversions.find((p) => p.fanId === fanId);
  const eligEntry = state.eligible.find((e) => e.fanId === fanId);

  const shareCount = eligEntry ? eligEntry.shareCount : 0;
  const purchaseCount = eligEntry ? eligEntry.purchaseCount : 0;

  const shareRank = shareEntry ? shareEntry.rank : eligEntry?.shareRank || null;
  const conversionRank = convEntry ? convEntry.rank : eligEntry?.conversionRank || null;

  const { tier, badges, ambassador } = computeTier({
    fanId,
    trendStarterFanId: state.starters.trendStarterFanId,
    conversionStarterFanId: state.starters.conversionStarterFanId,
    shareRank,
    conversionRank,
    shareCount,
    purchaseCount
  });

  return res.json({
    success: true,
    artistId,
    fanId,
    ambassador,
    tier,
    badges,
    shareCount,
    shareRank,
    trendStarterFanId: state.starters.trendStarterFanId,
    purchaseCount,
    conversionRank,
    conversionStarterFanId: state.starters.conversionStarterFanId,
    amountMinor: eligEntry ? eligEntry.amountMinor : 0,
    uniqueBuyers: eligEntry ? eligEntry.uniqueBuyers : 0,
    podium: state.podium,
    updatedAt: nowIso(),
    debug: {
      lookbackDays: state.days,
      refsIndexed: state.debug.refsIndexed,
      scannedSharesLines: state.debug.scannedSharesLines,
      scannedMonetisationLines: state.debug.scannedMonetisationLines
    }
  });
});

// Artist podium (top shares + conversions + starters)
router.get("/artist/:artistId/podium", async (req, res) => {
  const artistId = (req.params.artistId || "").toString().trim();
  if (!artistId) return res.status(400).json({ success: false, error: "missing_artistId" });

  const days = clamp(Number(req.query.days) || 120, 1, 365);
  const podiumSize = clamp(Number(req.query.podium) || 10, 1, 50);

  const state = await buildArtistAmbassadorState(artistId, days, podiumSize);
  return res.json({
    success: true,
    artistId,
    days,
    podiumSize,
    starters: state.starters,
    podium: state.podium,
    updatedAt: nowIso(),
    debug: state.debug
  });
});

// Eligible ambassador list (for UI + forum access later)
router.get("/artist/:artistId/eligible", async (req, res) => {
  const artistId = (req.params.artistId || "").toString().trim();
  if (!artistId) return res.status(400).json({ success: false, error: "missing_artistId" });

  const days = clamp(Number(req.query.days) || 120, 1, 365);
  const podiumSize = clamp(Number(req.query.podium) || 10, 1, 50);

  const state = await buildArtistAmbassadorState(artistId, days, podiumSize);

  return res.json({
    success: true,
    artistId,
    days,
    podiumSize,
    starters: state.starters,
    eligible: state.eligible,
    updatedAt: nowIso(),
    debug: state.debug
  });
});

export default router;