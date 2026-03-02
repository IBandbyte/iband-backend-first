/**
 * ranking.js (Phase H3.1) - ESM
 * -----------------------------
 * Ranking engine that reads monetisation from persistent disk
 * (/var/data/iband/db/monetisation) so deploys do not reset scores.
 */

import express from "express";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Artists storage
const DEFAULT_DATA_DIR = process.env.IBAND_DATA_DIR || "/var/data/iband/db";
const FALLBACK_LOCAL_DIR = path.join(__dirname, "data", "db");
const ARTISTS_FILE = process.env.IBAND_ARTISTS_FILE || "artists.json";

// Monetisation persistent storage
const MON_DIR = path.join(DEFAULT_DATA_DIR, "monetisation");
const EVENTS_DIR = path.join(MON_DIR, "events");
const CONFIG_DIR = path.join(MON_DIR, "config");
const SIGNALS_JSONL = path.join(EVENTS_DIR, "monetisation-signals.jsonl");
const WEIGHTS_JSON = path.join(CONFIG_DIR, "monetisation-weights.json");

// Ranking tuning
const SCORE_WEIGHTS = {
  votesWeight: 1.0,
  monetisationWeight: 3.0,
  freshnessWeight: 0.4,
  floorVotes: 0,
  maxBoostedScore: 100000
};

// cache
const CACHE = { ttlMs: 12_000, lastAt: 0, lastKey: "", lastValue: null };
const MON_CACHE = { ttlMs: 10_000, lastAt: 0, key: "", byArtist: new Map() };

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
  decay: { halfLifeDays: 21, maxLookbackDays: 120 },
  limits: { maxLineScan: 150000, maxReadBytes: 25 * 1024 * 1024 }
};

function nowIso() {
  return new Date().toISOString();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

async function fileExists(p) {
  try {
    await fsp.access(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveArtistsPath() {
  const p1 = path.join(DEFAULT_DATA_DIR, ARTISTS_FILE);
  if (await fileExists(p1)) return p1;

  const p2 = path.join(FALLBACK_LOCAL_DIR, ARTISTS_FILE);
  if (await fileExists(p2)) return p2;

  const p3 = path.join(__dirname, ARTISTS_FILE);
  if (await fileExists(p3)) return p3;

  return p1;
}

async function readJsonSafe(p, fallback) {
  try {
    const raw = await fsp.readFile(p, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function asArrayArtists(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    if (Array.isArray(data.artists)) return data.artists;
    if (Array.isArray(data.items)) return data.items;
  }
  return [];
}

function freshnessBoost(updatedAtIso) {
  if (!updatedAtIso) return 0;
  const t = new Date(updatedAtIso).getTime();
  if (!Number.isFinite(t)) return 0;

  const ageMs = Date.now() - t;
  if (ageMs <= 0) return 1;

  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return clamp(1 - ageDays / 30, 0, 1);
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
    return DEFAULT_WEIGHTS;
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

async function buildMonetisationIndex(lookbackDays) {
  const weights = await readWeights();
  const lb = clamp(Number(lookbackDays) || Number(weights.decay?.maxLookbackDays ?? 120) || 120, 1, 365);

  const maxBytes =
    Number(weights.limits?.maxReadBytes ?? DEFAULT_WEIGHTS.limits.maxReadBytes) ||
    DEFAULT_WEIGHTS.limits.maxReadBytes;

  const maxLines =
    Number(weights.limits?.maxLineScan ?? DEFAULT_WEIGHTS.limits.maxLineScan) ||
    DEFAULT_WEIGHTS.limits.maxLineScan;

  const lines = await safeReadJsonlLines(SIGNALS_JSONL, maxBytes);
  const byArtist = new Map();

  let scanned = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    scanned += 1;
    if (scanned > maxLines) break;

    const evt = safeJsonParse(lines[i]);
    if (!evt || !evt.artistId) continue;
    if (!withinLookback(evt.ts, lb)) continue;

    const s = computeEventScore(evt, weights);
    const amt = Number(evt.amountMinor) || 0;

    const row = byArtist.get(evt.artistId) || { rawScore: 0, events: 0, totalAmountMinor: 0, fanSet: new Set() };
    row.rawScore += s;
    row.events += 1;
    row.totalAmountMinor += amt;
    if (evt.fanId) row.fanSet.add(evt.fanId);
    byArtist.set(evt.artistId, row);
  }

  const out = new Map();
  for (const [artistId, row] of byArtist.entries()) {
    out.set(artistId, {
      monetisationScore: normalizeMonScore(row.rawScore),
      rawScore: row.rawScore,
      events: row.events,
      uniqueFans: row.fanSet.size,
      totalAmountMinor: row.totalAmountMinor
    });
  }

  return out;
}

async function getMonetisationForArtist(artistId, lookbackDays) {
  const key = `lb:${lookbackDays}`;
  const now = Date.now();

  if (MON_CACHE.byArtist.size && MON_CACHE.key === key && now - MON_CACHE.lastAt < MON_CACHE.ttlMs) {
    return MON_CACHE.byArtist.get(artistId) || { monetisationScore: 0 };
  }

  const built = await buildMonetisationIndex(lookbackDays);
  MON_CACHE.byArtist = built;
  MON_CACHE.key = key;
  MON_CACHE.lastAt = now;

  return MON_CACHE.byArtist.get(artistId) || { monetisationScore: 0 };
}

function computeCompositeScore({ votes, monetisationScore, updatedAt }) {
  const v = Math.max(SCORE_WEIGHTS.floorVotes, Number(votes) || 0);
  const m = clamp(Number(monetisationScore) || 0, 0, 100);
  const f = freshnessBoost(updatedAt);

  const composite =
    v * SCORE_WEIGHTS.votesWeight +
    m * SCORE_WEIGHTS.monetisationWeight +
    f * SCORE_WEIGHTS.freshnessWeight * 100;

  return clamp(composite, 0, SCORE_WEIGHTS.maxBoostedScore);
}

router.get("/health", async (req, res) => {
  const artistsPath = await resolveArtistsPath();

  let monStat = null;
  try {
    monStat = await fsp.stat(SIGNALS_JSONL);
  } catch {
    monStat = null;
  }

  return res.json({
    success: true,
    service: "ranking",
    phase: "H3.1",
    monetisationStorageDir: MON_DIR,
    monetisationFile: {
      path: SIGNALS_JSONL,
      ok: !!monStat,
      size: monStat ? monStat.size : 0,
      mtimeMs: monStat ? monStat.mtimeMs : null
    },
    artistsFilePath: artistsPath,
    updatedAt: nowIso()
  });
});

router.get("/top", async (req, res) => {
  const limit = clamp(Number(req.query.limit) || 25, 1, 100);
  const includeMonetisation = String(req.query.includeMonetisation ?? "true") !== "false";
  const lookbackDays = clamp(Number(req.query.days) || 120, 1, 365);

  const cacheKey = `top|${limit}|${includeMonetisation}|${lookbackDays}`;
  const now = Date.now();
  if (CACHE.lastValue && CACHE.lastKey === cacheKey && now - CACHE.lastAt < CACHE.ttlMs) {
    return res.json({ ...CACHE.lastValue, cache: { hit: true, ttlMs: CACHE.ttlMs } });
  }

  const artistsPath = await resolveArtistsPath();
  const raw = await readJsonSafe(artistsPath, []);
  const artists = asArrayArtists(raw);

  const rows = [];
  for (const a of artists) {
    const id = (a.id || a.artistId || a.slug || "").toString();
    if (!id) continue;

    const votes = Number(a.votes ?? a.voteCount ?? 0) || 0;
    const updatedAt = a.updatedAt || a.lastActiveAt || a.modifiedAt || null;

    const mon = includeMonetisation ? await getMonetisationForArtist(id, lookbackDays) : { monetisationScore: 0 };

    const compositeScore = computeCompositeScore({
      votes,
      monetisationScore: mon.monetisationScore,
      updatedAt
    });

    rows.push({
      id,
      name: a.name || a.artistName || id,
      genre: a.genre || a.primaryGenre || "",
      location: a.location || "",
      imageUrl: a.imageUrl || a.image || "",
      votes,
      monetisationScore: mon.monetisationScore,
      compositeScore,
      updatedAt
    });
  }

  rows.sort((x, y) => y.compositeScore - x.compositeScore);

  const payload = {
    success: true,
    list: rows.slice(0, limit),
    meta: { limit, includeMonetisation, days: lookbackDays, scored: rows.length, updatedAt: nowIso() },
    cache: { hit: false, ttlMs: CACHE.ttlMs }
  };

  CACHE.lastAt = now;
  CACHE.lastKey = cacheKey;
  CACHE.lastValue = payload;

  return res.json(payload);
});

export default router;