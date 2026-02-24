/**
 * achievements.js (root) — ESM default export
 * iBand Achievements Store (v2)
 *
 * v2 Upgrade:
 * - Adds global feed endpoint: GET /api/achievements/feed?limit=20
 * - Adds optional filters: type=..., subjectType=...
 * - Keeps subject timeline endpoint
 * - Safe file store with atomic writes
 * - Dedup guard (retry-safe)
 * - Render-safe, always JSON
 *
 * Endpoints:
 * - GET  /api/achievements/health
 * - POST /api/achievements/record
 * - GET  /api/achievements/subject/:subjectType/:subjectId?limit=50
 * - GET  /api/achievements/feed?limit=50&type=achievement&subjectType=fan
 */

import express from "express";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";

const router = express.Router();

// -------------------- Config --------------------
const SERVICE = "achievements";
const VERSION = 2;

const DATA_DIR = process.env.IBAND_DATA_DIR || "/var/data/iband/db";
const STORE_FILE =
  process.env.IBAND_ACHIEVEMENTS_FILE || path.join(DATA_DIR, "achievements.json");

const MAX_RETURN = parseInt(process.env.ACHIEVEMENTS_MAX_RETURN || "50", 10);
const CACHE_TTL_MS = parseInt(process.env.ACHIEVEMENTS_CACHE_TTL_MS || "15000", 10);

// Retry-safe dedupe window (seconds)
const DEDUPE_WINDOW_SEC = parseInt(process.env.ACHIEVEMENTS_DEDUPE_WINDOW_SEC || "30", 10);

// -------------------- Helpers --------------------
function nowIso() {
  return new Date().toISOString();
}

function safeNumber(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

async function statOk(p) {
  try {
    const s = await fsp.stat(p);
    return { ok: true, size: s.size, mtimeMs: s.mtimeMs };
  } catch (e) {
    return { ok: false, error: e?.code || String(e) };
  }
}

function ensureDirSync(dir) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {
    // best effort
  }
}

async function readStore() {
  const base = { version: 1, updatedAt: null, items: [] };

  try {
    if (!fs.existsSync(STORE_FILE)) return { ok: true, store: base, created: true, error: null };
    const raw = await fsp.readFile(STORE_FILE, "utf8");
    const parsed = safeJsonParse(raw, null);
    if (!parsed || typeof parsed !== "object") return { ok: true, store: base, created: true, error: "EJSON" };

    const store = {
      version: safeNumber(parsed.version, 1),
      updatedAt: parsed.updatedAt || null,
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };

    // sanitize items
    store.items = store.items
      .filter((x) => x && typeof x === "object")
      .map((x) => ({
        id: String(x.id || "").trim() || null,
        at: x.at || null,
        type: x.type || "achievement",
        subjectType: x.subjectType || null,
        subjectId: x.subjectId || null,
        medal: x.medal || null,
        title: x.title || null,
        message: x.message || null,
        stats: x.stats || null,
        subject: x.subject || null,
        meta: x.meta || null,
        v: safeNumber(x.v, 1),
      }))
      .filter((x) => x.id && x.at && x.subjectType && x.subjectId);

    return { ok: true, store, created: false, error: null };
  } catch (e) {
    return { ok: false, store: base, created: false, error: e?.message || "EREAD" };
  }
}

async function writeStoreAtomic(store) {
  ensureDirSync(DATA_DIR);
  const tmp = `${STORE_FILE}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  const payload = JSON.stringify(store, null, 2);
  await fsp.writeFile(tmp, payload, "utf8");
  await fsp.rename(tmp, STORE_FILE);
}

function makeId(prefix = "ach") {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}

function makeDedupeKey(a) {
  const medalCode = a?.medal?.code ? String(a.medal.code) : "";
  const message = a?.message ? String(a.message) : "";
  const title = a?.title ? String(a.title) : "";
  const type = String(a?.type || "achievement");
  const subjectType = String(a?.subjectType || "");
  const subjectId = String(a?.subjectId || "");
  const stats = a?.stats ? JSON.stringify(a.stats) : "";
  const raw = `${type}|${subjectType}|${subjectId}|${medalCode}|${title}|${message}|${stats}`;
  return crypto.createHash("sha1").update(raw).digest("hex");
}

function withinSeconds(isoA, isoB, seconds) {
  const a = Date.parse(isoA);
  const b = Date.parse(isoB);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(b - a) <= seconds * 1000;
}

function normalizeLimit(q, fallback = 50) {
  return clamp(parseInt(String(q ?? fallback), 10) || fallback, 1, MAX_RETURN);
}

function filterItem(item, { type, subjectType }) {
  if (type && String(item.type) !== String(type)) return false;
  if (subjectType && String(item.subjectType) !== String(subjectType)) return false;
  return true;
}

function sortNewestFirst(items) {
  return items
    .slice()
    .sort((a, b) => {
      const ta = Date.parse(a.at || 0);
      const tb = Date.parse(b.at || 0);
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });
}

// -------------------- Cache --------------------
let _cache = {
  atMs: 0,
  store: null,
};

async function getStoreCached() {
  const now = Date.now();
  const age = now - _cache.atMs;
  if (_cache.store && age >= 0 && age <= CACHE_TTL_MS) {
    return { ok: true, store: _cache.store, cached: true, cacheAgeMs: age };
  }

  const read = await readStore();
  if (!read.ok) return { ok: false, store: read.store, cached: false, cacheAgeMs: 0, error: read.error };

  _cache = { atMs: now, store: read.store };
  return { ok: true, store: read.store, cached: false, cacheAgeMs: 0 };
}

function bustCache() {
  _cache = { atMs: 0, store: null };
}

// -------------------- Validation --------------------
function validateAchievementPayload(body) {
  const type = String(body?.type || "").trim();
  const subjectType = String(body?.subjectType || "").trim();
  const subjectId = String(body?.subjectId || "").trim();

  if (!type || !subjectType || !subjectId) {
    return { ok: false, message: "Invalid achievement payload. Requires: type, subjectType, subjectId." };
  }

  const medal = body?.medal && typeof body.medal === "object" ? body.medal : null;

  const out = {
    type,
    subjectType,
    subjectId,
    medal,
    title: body?.title ?? null,
    message: body?.message ?? null,
    stats: body?.stats && typeof body.stats === "object" ? body.stats : null,
    subject: body?.subject && typeof body.subject === "object" ? body.subject : null,
    meta: body?.meta && typeof body.meta === "object" ? body.meta : null,
    v: 1,
  };

  return { ok: true, value: out };
}

// -------------------- Endpoints --------------------
router.get("/health", async (_req, res) => {
  const st = await statOk(STORE_FILE);
  const cached = await getStoreCached();

  const store = cached.ok ? cached.store : { version: 1, updatedAt: null, items: [] };
  const items = Array.isArray(store.items) ? store.items : [];

  // basic subject index count (computed)
  const subjects = new Set(items.map((x) => `${x.subjectType}:${x.subjectId}`));

  return res.json({
    success: true,
    service: SERVICE,
    version: VERSION,
    updatedAt: nowIso(),
    dataDir: DATA_DIR,
    file: { ...st, path: STORE_FILE },
    store: {
      version: safeNumber(store.version, 1),
      updatedAt: store.updatedAt || null,
      items: items.length,
      subjectsIndexed: subjects.size,
    },
    cache: {
      ttlMs: CACHE_TTL_MS,
      cached: cached.ok ? cached.cached : false,
      cacheAgeMs: cached.ok ? cached.cacheAgeMs : 0,
    },
  });
});

// Record
router.post("/record", express.json({ limit: "128kb" }), async (req, res) => {
  const v = validateAchievementPayload(req.body);
  if (!v.ok) {
    return res.status(400).json({ success: false, message: v.message, updatedAt: nowIso() });
  }

  const read = await readStore();
  if (!read.ok) {
    return res.status(500).json({
      success: false,
      message: "Failed to read achievements store.",
      error: read.error,
      updatedAt: nowIso(),
    });
  }

  const store = read.store;
  const items = Array.isArray(store.items) ? store.items : [];

  const ach = {
    id: makeId("ach"),
    at: nowIso(),
    ...v.value,
  };

  // Dedup guard: if an identical achievement exists for same subject in last N seconds, do not add again.
  const key = makeDedupeKey(ach);
  const recently = items
    .filter((x) => x.subjectType === ach.subjectType && x.subjectId === ach.subjectId)
    .slice(-50);

  const deduped = recently.some((x) => {
    const k2 = makeDedupeKey(x);
    return k2 === key && withinSeconds(x.at, ach.at, DEDUPE_WINDOW_SEC);
  });

  if (!deduped) {
    items.push(ach);
    // cap store size to protect disk (keep last 10k)
    const HARD_CAP = 10000;
    const nextItems = items.length > HARD_CAP ? items.slice(items.length - HARD_CAP) : items;

    const nextStore = {
      version: safeNumber(store.version, 1),
      updatedAt: ach.at,
      items: nextItems,
    };

    try {
      await writeStoreAtomic(nextStore);
      bustCache();
      return res.json({
        success: true,
        updatedAt: nextStore.updatedAt,
        recorded: true,
        deduped: false,
        achievement: ach,
      });
    } catch (e) {
      return res.status(500).json({
        success: false,
        message: "Failed to write achievements store.",
        error: e?.message || "EWRITE",
        updatedAt: nowIso(),
      });
    }
  }

  return res.json({
    success: true,
    updatedAt: store.updatedAt || nowIso(),
    recorded: false,
    deduped: true,
    achievement: ach,
  });
});

// Subject timeline
router.get("/subject/:subjectType/:subjectId", async (req, res) => {
  const subjectType = String(req.params.subjectType || "").trim();
  const subjectId = String(req.params.subjectId || "").trim();
  const limit = normalizeLimit(req.query.limit, 50);

  const cached = await getStoreCached();
  if (!cached.ok) {
    return res.status(500).json({
      success: false,
      message: "Failed to load achievements store.",
      error: cached.error,
      updatedAt: nowIso(),
    });
  }

  const store = cached.store;
  const items = Array.isArray(store.items) ? store.items : [];

  const results = sortNewestFirst(
    items.filter((x) => x.subjectType === subjectType && x.subjectId === subjectId)
  ).slice(0, limit);

  return res.json({
    success: true,
    updatedAt: store.updatedAt || nowIso(),
    subjectType,
    subjectId,
    count: results.length,
    results,
    cached: cached.cached,
  });
});

// ✅ NEW: Global feed
router.get("/feed", async (req, res) => {
  const limit = normalizeLimit(req.query.limit, 50);
  const type = req.query.type ? String(req.query.type).trim() : null;
  const subjectType = req.query.subjectType ? String(req.query.subjectType).trim() : null;

  const cached = await getStoreCached();
  if (!cached.ok) {
    return res.status(500).json({
      success: false,
      message: "Failed to load achievements store.",
      error: cached.error,
      updatedAt: nowIso(),
    });
  }

  const store = cached.store;
  const items = Array.isArray(store.items) ? store.items : [];

  const filtered = items.filter((x) => filterItem(x, { type, subjectType }));
  const results = sortNewestFirst(filtered).slice(0, limit);

  return res.json({
    success: true,
    updatedAt: store.updatedAt || nowIso(),
    filters: { type, subjectType },
    count: results.length,
    results,
    cached: cached.cached,
    cacheAgeMs: cached.cacheAgeMs,
  });
});

export default router;