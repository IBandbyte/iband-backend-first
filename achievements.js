/**
 * achievements.js (root) — ESM default export
 * iBand Achievements / Medal Cabinet Engine (v1)
 *
 * Purpose:
 * - Persist "proof of progress" for Fans + Artists:
 *   - Flash medals (24h)
 *   - Future: weekly podium placements
 *   - Future: chart placements (Top 40)
 *   - Future: long-term medals unlocks
 *
 * Storage (Render disk MVP):
 * - /var/data/iband/db/achievements.json
 *
 * Endpoints:
 * - GET  /api/achievements/health
 * - GET  /api/achievements/subject/:subjectType/:subjectId?limit=50
 * - GET  /api/achievements/recent?limit=50
 * - POST /api/achievements/record   (internal/admin; records a single achievement)
 * - POST /api/achievements/scan-flash?windowHours=24&limit=50
 *   -> calls local flash-medals engine via internal function import if available
 *   -> else falls back to HTTP fetch against same server origin
 *
 * Captain’s Protocol:
 * - Full canonical file (no snippets)
 * - Render-safe / file-backed / JSON always
 */

import express from "express";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const router = express.Router();

// -------------------- Config --------------------
const SERVICE = "achievements";
const VERSION = 1;

const DATA_DIR = process.env.DATA_DIR || process.env.IBAND_DATA_DIR || "/var/data/iband/db";
const ACH_FILE = process.env.ACHIEVEMENTS_FILE || path.join(DATA_DIR, "achievements.json");

// Limits
const MAX_RETURN = parseInt(process.env.ACH_MAX_RETURN || "50", 10);
const CACHE_TTL_MS = parseInt(process.env.ACH_CACHE_TTL_MS || "15000", 10);

// Optional shared defaults
const DEFAULT_LIMIT = 50;

// -------------------- Small helpers --------------------
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

function normalizeType(s) {
  return String(s || "").trim().toLowerCase();
}

function normalizeId(s) {
  return String(s || "").trim();
}

function makeId(prefix = "ach") {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // ignore
  }
}

async function readJsonSafe(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

// atomic write
async function writeJsonAtomic(filePath, obj) {
  const tmp = `${filePath}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

function baseShape() {
  return {
    version: 1,
    updatedAt: null,
    // Append-only log
    items: [],
    // Fast index: subjectKey -> [ids newest first]
    index: {},
  };
}

function subjectKey(subjectType, subjectId) {
  return `${normalizeType(subjectType)}:${normalizeId(subjectId)}`;
}

function coerceAchievement(input) {
  const type = normalizeType(input?.type);
  const subjectType = normalizeType(input?.subjectType);
  const subjectId = normalizeId(input?.subjectId);

  if (!type || !subjectType || !subjectId) return null;

  const medal = input?.medal && typeof input.medal === "object" ? input.medal : null;

  return {
    id: normalizeId(input?.id) || makeId("ach"),
    at: input?.at || nowIso(),
    type, // e.g. "flash_medal", "weekly_podium", "chart_entry", "long_medal"
    subjectType, // "fan" | "artist" | "label" etc
    subjectId,
    // optional fields for UX
    medal,
    title: input?.title ?? null,
    message: input?.message ?? null,
    // optional stats snapshot
    stats: (input?.stats && typeof input.stats === "object") ? input.stats : null,
    // optional artist/fan profile snapshot
    subject: (input?.subject && typeof input.subject === "object") ? input.subject : null,
    // misc metadata
    meta: (input?.meta && typeof input.meta === "object") ? input.meta : null,
    v: 1,
  };
}

// -------------------- Cache --------------------
let _cache = {
  atMs: 0,
  value: null,
};

function cacheGet() {
  if (!_cache.value) return null;
  const age = Date.now() - _cache.atMs;
  if (age > CACHE_TTL_MS) return null;
  return _cache.value;
}

function cacheSet(val) {
  _cache = { atMs: Date.now(), value: val };
}

function cacheClear() {
  _cache = { atMs: 0, value: null };
}

// -------------------- Load/Save --------------------
async function loadStore() {
  const cached = cacheGet();
  if (cached) return { ok: true, store: cached, cached: true };

  await ensureDir(DATA_DIR);

  const store = await readJsonSafe(ACH_FILE, baseShape());
  if (!store || typeof store !== "object") return { ok: true, store: baseShape(), cached: false };

  if (!Array.isArray(store.items)) store.items = [];
  if (!store.index || typeof store.index !== "object") store.index = {};
  if (!store.version) store.version = 1;

  cacheSet(store);
  return { ok: true, store, cached: false };
}

async function saveStore(store) {
  store.updatedAt = nowIso();
  await ensureDir(DATA_DIR);
  await writeJsonAtomic(ACH_FILE, store);
  cacheSet(store);
  return store;
}

// -------------------- Core ops --------------------
function indexAdd(store, ach) {
  const key = subjectKey(ach.subjectType, ach.subjectId);
  if (!store.index[key]) store.index[key] = [];
  // newest first
  store.index[key].unshift(ach.id);
  // keep index arrays bounded
  store.index[key] = store.index[key].slice(0, 500);
}

function storeHasId(store, id) {
  return store.items.some((x) => x && x.id === id);
}

function recordAchievement(store, ach) {
  if (!ach) return { ok: false, error: "invalid" };
  if (storeHasId(store, ach.id)) {
    return { ok: true, deduped: true, item: ach };
  }
  store.items.push(ach);
  indexAdd(store, ach);
  // keep items bounded
  if (store.items.length > 5000) store.items = store.items.slice(-5000);
  return { ok: true, deduped: false, item: ach };
}

function getSubjectAchievements(store, subjectType, subjectId, limit) {
  const key = subjectKey(subjectType, subjectId);
  const ids = Array.isArray(store.index[key]) ? store.index[key] : [];
  const lim = clamp(safeNumber(limit, DEFAULT_LIMIT), 1, MAX_RETURN);

  // Pull by id while preserving order
  const map = new Map(store.items.map((x) => [x.id, x]));
  const out = [];
  for (const id of ids) {
    const it = map.get(id);
    if (it) out.push(it);
    if (out.length >= lim) break;
  }
  return out;
}

function getRecent(store, limit) {
  const lim = clamp(safeNumber(limit, DEFAULT_LIMIT), 1, MAX_RETURN);
  const items = Array.isArray(store.items) ? store.items : [];
  // items are append-only; recent = tail
  return items.slice(-lim).reverse();
}

// -------------------- Flash medals integration --------------------
// Prefer direct import to avoid HTTP. Fall back to fetch.
async function tryGetFlashMedalsInternal(windowHours, limit) {
  try {
    // Dynamic import so missing file never breaks deploy
    const mod = await import("./flashMedals.js");
    const maybeFn = mod?.computeFlashMedalsSnapshot;
    if (typeof maybeFn !== "function") return { ok: false, error: "no_internal_fn" };

    const snap = await maybeFn({
      windowHours,
      limit,
      includeProfiles: true,
    });

    return { ok: true, snapshot: snap };
  } catch (e) {
    return { ok: false, error: e?.message || "import_failed" };
  }
}

async function tryGetFlashMedalsViaHttp(req, windowHours, limit) {
  try {
    const origin =
      (req.headers["x-forwarded-proto"] && req.headers["x-forwarded-host"])
        ? `${req.headers["x-forwarded-proto"]}://${req.headers["x-forwarded-host"]}`
        : `${req.protocol}://${req.get("host")}`;

    const url = new URL(`${origin}/api/flash-medals/list`);
    url.searchParams.set("windowHours", String(windowHours));
    url.searchParams.set("limit", String(limit));

    const r = await fetch(url.toString(), { method: "GET" });
    const json = await r.json().catch(() => null);
    if (!r.ok || !json || json.success !== true) {
      return { ok: false, error: "http_failed", status: r.status, body: json };
    }
    return { ok: true, snapshot: json };
  } catch (e) {
    return { ok: false, error: e?.message || "fetch_failed" };
  }
}

// Convert flash-medals list response into achievements
function achievementsFromFlashSnapshot(snapshot) {
  // snapshot expected shape:
  // { success:true, updatedAt, windowHours, expiresAt, results:[{type, at, subjectId, medal, message, stats, artist?...}] }
  const list = Array.isArray(snapshot?.results) ? snapshot.results : [];
  const out = [];

  for (const row of list) {
    const t = normalizeType(row?.type); // "artist" | "fan"
    const sid = normalizeId(row?.subjectId);
    const at = row?.at || null;
    const medal = row?.medal && typeof row.medal === "object" ? row.medal : null;
    if (!t || !sid || !medal) continue;

    // Stable id: same flash medal same subject same "at" => same achievement id
    const stableId = `flash_${t}_${sid}_${normalizeId(medal.code || medal.label || "medal")}_${String(at || "na")}`;

    out.push(
      coerceAchievement({
        id: stableId,
        at: at || nowIso(),
        type: "flash_medal",
        subjectType: t,
        subjectId: sid,
        medal,
        title: medal.label || "Flash Medal",
        message: row?.message ?? null,
        stats: row?.stats ?? null,
        subject: row?.artist ?? null, // for artist rows flash feed includes artist summary
        meta: {
          windowHours: snapshot?.windowHours ?? null,
          expiresAt: snapshot?.expiresAt ?? null,
        },
      })
    );
  }

  return out.filter(Boolean);
}

// -------------------- Endpoints --------------------

// Health
router.get("/health", async (_req, res) => {
  const st = await loadStore();
  const store = st.store;

  // basic file stat
  let fileStat = { ok: false };
  try {
    const s = await fs.stat(ACH_FILE);
    fileStat = { ok: true, size: s.size, mtimeMs: s.mtimeMs, path: ACH_FILE };
  } catch (e) {
    fileStat = { ok: false, error: e?.code || String(e), path: ACH_FILE };
  }

  return res.json({
    success: true,
    service: SERVICE,
    version: VERSION,
    updatedAt: nowIso(),
    dataDir: DATA_DIR,
    file: fileStat,
    store: {
      version: store.version,
      updatedAt: store.updatedAt,
      items: store.items.length,
      subjectsIndexed: Object.keys(store.index || {}).length,
    },
    cache: {
      ttlMs: CACHE_TTL_MS,
      cached: st.cached,
      cacheAgeMs: st.cached ? (Date.now() - _cache.atMs) : 0,
    },
  });
});

// Recent achievements
router.get("/recent", async (req, res) => {
  const limit = clamp(safeNumber(req.query.limit, DEFAULT_LIMIT), 1, MAX_RETURN);
  const st = await loadStore();
  const store = st.store;

  const recent = getRecent(store, limit);

  return res.json({
    success: true,
    updatedAt: store.updatedAt || nowIso(),
    count: recent.length,
    results: recent,
    cached: st.cached,
  });
});

// Subject medal cabinet
router.get("/subject/:subjectType/:subjectId", async (req, res) => {
  const subjectType = normalizeType(req.params.subjectType);
  const subjectId = normalizeId(req.params.subjectId);
  const limit = clamp(safeNumber(req.query.limit, DEFAULT_LIMIT), 1, MAX_RETURN);

  const st = await loadStore();
  const store = st.store;

  const items = getSubjectAchievements(store, subjectType, subjectId, limit);

  return res.json({
    success: true,
    updatedAt: store.updatedAt || nowIso(),
    subjectType,
    subjectId,
    count: items.length,
    results: items,
    cached: st.cached,
  });
});

// Record one achievement (internal/admin)
router.post("/record", async (req, res) => {
  const ach = coerceAchievement(req.body || {});
  if (!ach) {
    return res.status(400).json({
      success: false,
      message: "Invalid achievement payload. Requires: type, subjectType, subjectId.",
      updatedAt: nowIso(),
    });
  }

  const st = await loadStore();
  const store = st.store;

  const r = recordAchievement(store, ach);
  await saveStore(store);
  cacheClear();

  return res.json({
    success: true,
    updatedAt: store.updatedAt || nowIso(),
    recorded: true,
    deduped: !!r.deduped,
    achievement: ach,
  });
});

// Scan flash medals and persist into achievements.json
router.post("/scan-flash", async (req, res) => {
  const windowHours = clamp(safeNumber(req.query.windowHours, 24), 0.1, 72);
  const limit = clamp(safeNumber(req.query.limit, 50), 1, MAX_RETURN);

  // 1) Get flash medals snapshot
  let snapRes = await tryGetFlashMedalsInternal(windowHours, limit);

  if (!snapRes.ok) {
    snapRes = await tryGetFlashMedalsViaHttp(req, windowHours, limit);
  }

  if (!snapRes.ok) {
    return res.status(500).json({
      success: false,
      message: "Could not retrieve flash medals snapshot.",
      updatedAt: nowIso(),
      error: snapRes.error,
      hint: "Ensure /api/flash-medals/list works and flashMedals.js exists.",
    });
  }

  const snapshot = snapRes.snapshot;
  const derived = achievementsFromFlashSnapshot(snapshot);

  const st = await loadStore();
  const store = st.store;

  let added = 0;
  let deduped = 0;

  for (const ach of derived) {
    const r = recordAchievement(store, ach);
    if (r.ok && r.deduped) deduped += 1;
    if (r.ok && !r.deduped) added += 1;
  }

  await saveStore(store);
  cacheClear();

  return res.json({
    success: true,
    updatedAt: store.updatedAt || nowIso(),
    scanned: "flash-medals",
    windowHours,
    derivedCount: derived.length,
    added,
    deduped,
    snapshotMeta: {
      expiresAt: snapshot?.expiresAt ?? null,
      count: Array.isArray(snapshot?.results) ? snapshot.results.length : 0,
    },
  });
});

export default router;