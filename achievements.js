/**
 * achievements.js (root) — ESM default export
 * iBand Achievements Engine (v2)
 *
 * Captain’s Protocol:
 * - Full canonical file (no snippets)
 * - Render-safe disk persistence (/var/data/iband/db)
 * - Always JSON responses
 * - Backwards-compatible routes
 *
 * Storage:
 * - /var/data/iband/db/achievements.json
 *
 * Endpoints (mounted at /api/achievements):
 * - GET  /health
 * - POST /record
 * - GET  /list?type=&subjectType=&subjectId=&limit=&order=desc|asc
 * - GET  /feed?limit=20   (alias of /list)
 * - GET  /subject/:subjectType/:subjectId?limit=
 * - GET  /id/:id
 *
 * Back-compat aliases:
 * - GET  /all           (alias of /list)
 * - GET  /by-subject    (query: subjectType, subjectId)
 * - GET  /              (alias of /list, so /api/achievements?type=... works)
 */

import express from "express";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const router = express.Router();

// -------------------- Config --------------------
const SERVICE = "achievements";
const VERSION = 2;

const DATA_DIR = process.env.IBAND_DATA_DIR || "/var/data/iband/db";
const FILE_PATH =
  process.env.IBAND_ACHIEVEMENTS_FILE || path.join(DATA_DIR, "achievements.json");

const CACHE_TTL_MS = parseInt(process.env.ACHIEVEMENTS_CACHE_TTL_MS || "15000", 10);
const MAX_STORE_ITEMS = parseInt(process.env.ACHIEVEMENTS_MAX_STORE_ITEMS || "5000", 10);
const MAX_RETURN = parseInt(process.env.ACHIEVEMENTS_MAX_RETURN || "100", 10);

// Dedup window: prevents spam if client retries
const DEDUPE_WINDOW_SEC = parseInt(process.env.ACHIEVEMENTS_DEDUPE_WINDOW_SEC || "120", 10);

// -------------------- In-memory cache --------------------
let _cache = {
  atMs: 0,
  store: null,
};

// -------------------- Utils --------------------
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

function normalizeStr(s) {
  return String(s || "").trim();
}

function toLower(s) {
  return normalizeStr(s).toLowerCase();
}

function mkId(prefix = "ach") {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}

async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch {
    // best effort
  }
}

async function statSafe(p) {
  try {
    const s = await fs.stat(p);
    return { ok: true, size: s.size, mtimeMs: s.mtimeMs };
  } catch (e) {
    return { ok: false, error: e?.code || String(e) };
  }
}

async function readJsonSafe(p, fallback) {
  try {
    const raw = await fs.readFile(p, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(p, obj) {
  const dir = path.dirname(p);
  await ensureDir(dir);

  const tmp = `${p}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  const raw = JSON.stringify(obj, null, 2);
  await fs.writeFile(tmp, raw, "utf8");
  await fs.rename(tmp, p);
}

function baseEmptyStore() {
  return {
    version: 1,
    updatedAt: null,
    items: [], // newest-last (append-only)
  };
}

function buildIndex(store) {
  // subject index: `${subjectType}:${subjectId}` => [itemIds...]
  const bySubject = {};
  for (const it of store.items || []) {
    const st = normalizeStr(it?.subjectType);
    const sid = normalizeStr(it?.subjectId);
    if (!st || !sid) continue;
    const key = `${st}:${sid}`;
    if (!bySubject[key]) bySubject[key] = [];
    bySubject[key].push(it.id);
  }
  return { bySubject };
}

function summarizeStore(store) {
  const idx = buildIndex(store);
  return {
    version: store.version || 1,
    updatedAt: store.updatedAt || null,
    items: Array.isArray(store.items) ? store.items.length : 0,
    subjectsIndexed: Object.keys(idx.bySubject).length,
  };
}

function computeDedupeKey(ach) {
  const parts = [
    toLower(ach?.type),
    toLower(ach?.subjectType),
    normalizeStr(ach?.subjectId),
    toLower(ach?.medal?.code || ach?.medal?.tier || ""),
    normalizeStr(ach?.title || ""),
    normalizeStr(ach?.message || ""),
  ];
  return crypto.createHash("sha1").update(parts.join("|")).digest("hex");
}

function isValidAchievementPayload(body) {
  // required: type, subjectType, subjectId
  const type = normalizeStr(body?.type);
  const subjectType = normalizeStr(body?.subjectType);
  const subjectId = normalizeStr(body?.subjectId);
  if (!type || !subjectType || !subjectId) return false;
  return true;
}

function normalizeAchievement(body) {
  const at = body?.at ? String(body.at) : nowIso();
  const type = normalizeStr(body?.type);
  const subjectType = normalizeStr(body?.subjectType);
  const subjectId = normalizeStr(body?.subjectId);

  // Optional medal object (flash/weekly/lifetime etc)
  const medal =
    body?.medal && typeof body.medal === "object"
      ? {
          tier: normalizeStr(body.medal.tier) || null,
          code: normalizeStr(body.medal.code) || null,
          label: normalizeStr(body.medal.label) || null,
          emoji: normalizeStr(body.medal.emoji) || null,
          hex: normalizeStr(body.medal.hex) || null,
        }
      : null;

  const stats =
    body?.stats && typeof body.stats === "object"
      ? body.stats
      : null;

  const subject =
    body?.subject && typeof body.subject === "object"
      ? body.subject
      : null;

  const meta =
    body?.meta && typeof body.meta === "object"
      ? body.meta
      : null;

  const title = body?.title != null ? String(body.title) : null;
  const message = body?.message != null ? String(body.message) : null;

  return {
    id: mkId("ach"),
    at,
    type,
    subjectType,
    subjectId,
    medal,
    title,
    message,
    stats,
    subject,
    meta,
    v: 1,
  };
}

// -------------------- Load / Save --------------------
async function loadStore({ bypassCache = false } = {}) {
  const now = Date.now();
  if (!bypassCache && _cache.store && now - _cache.atMs <= CACHE_TTL_MS) {
    return { ok: true, store: _cache.store, cached: true, cacheAgeMs: now - _cache.atMs };
  }

  const base = baseEmptyStore();
  const parsed = await readJsonSafe(FILE_PATH, base);

  const store = {
    version: safeNumber(parsed.version, 1),
    updatedAt: parsed.updatedAt || null,
    items: Array.isArray(parsed.items) ? parsed.items : [],
  };

  _cache = { atMs: now, store };
  return { ok: true, store, cached: false, cacheAgeMs: 0 };
}

async function saveStore(store) {
  store.updatedAt = nowIso();

  // Hard cap
  if (Array.isArray(store.items) && store.items.length > MAX_STORE_ITEMS) {
    store.items = store.items.slice(store.items.length - MAX_STORE_ITEMS);
  }

  await writeJsonAtomic(FILE_PATH, store);

  _cache = { atMs: Date.now(), store };
  return true;
}

// -------------------- Query helpers --------------------
function filterAndSortItems(items, { type, subjectType, subjectId, order }) {
  let out = Array.isArray(items) ? items.slice() : [];

  const t = type ? toLower(type) : null;
  const st = subjectType ? toLower(subjectType) : null;
  const sid = subjectId ? normalizeStr(subjectId) : null;

  if (t) out = out.filter((x) => toLower(x?.type) === t);
  if (st) out = out.filter((x) => toLower(x?.subjectType) === st);
  if (sid) out = out.filter((x) => normalizeStr(x?.subjectId) === sid);

  const ord = toLower(order || "desc");
  out.sort((a, b) => {
    const ta = Date.parse(a?.at || "") || 0;
    const tb = Date.parse(b?.at || "") || 0;
    return ord === "asc" ? ta - tb : tb - ta;
  });

  return out;
}

function applyLimit(items, limit) {
  const lim = clamp(safeNumber(limit, 20), 1, MAX_RETURN);
  return items.slice(0, lim);
}

// -------------------- Routes --------------------

// Health
router.get("/health", async (_req, res) => {
  const st = await statSafe(FILE_PATH);
  const loaded = await loadStore();
  res.json({
    success: true,
    service: SERVICE,
    version: VERSION,
    updatedAt: nowIso(),
    dataDir: DATA_DIR,
    file: { ...st, path: FILE_PATH },
    store: summarizeStore(loaded.store),
    cache: {
      ttlMs: CACHE_TTL_MS,
      cached: loaded.cached,
      cacheAgeMs: loaded.cacheAgeMs,
    },
  });
});

// Record
router.post("/record", async (req, res) => {
  if (!isValidAchievementPayload(req.body)) {
    return res.status(400).json({
      success: false,
      message: "Invalid achievement payload. Requires: type, subjectType, subjectId.",
      updatedAt: nowIso(),
    });
  }

  const loaded = await loadStore({ bypassCache: true });
  const store = loaded.store;

  const incoming = normalizeAchievement(req.body);
  const dedupeKey = computeDedupeKey(incoming);

  // Dedup within window seconds
  const windowMs = clamp(DEDUPE_WINDOW_SEC, 0, 3600) * 1000;
  let deduped = false;

  if (windowMs > 0 && Array.isArray(store.items) && store.items.length) {
    const now = Date.now();
    // scan last 200 only (fast)
    const tail = store.items.slice(-200);
    for (let i = tail.length - 1; i >= 0; i--) {
      const prev = tail[i];
      const prevAt = Date.parse(prev?.at || "");
      if (!Number.isFinite(prevAt)) continue;

      if (now - prevAt > windowMs) break;

      const prevKey = prev?.dedupeKey || computeDedupeKey(prev);
      if (prevKey === dedupeKey) {
        deduped = true;
        return res.json({
          success: true,
          updatedAt: store.updatedAt || nowIso(),
          recorded: false,
          deduped: true,
          achievement: prev,
        });
      }
    }
  }

  // persist dedupeKey on item
  incoming.dedupeKey = dedupeKey;

  store.items.push(incoming);
  await saveStore(store);

  return res.json({
    success: true,
    updatedAt: store.updatedAt,
    recorded: true,
    deduped,
    achievement: incoming,
  });
});

// LIST (canonical)
router.get("/list", async (req, res) => {
  const { type, subjectType, subjectId, limit, order } = req.query || {};

  const loaded = await loadStore();
  const store = loaded.store;

  const filtered = filterAndSortItems(store.items, {
    type,
    subjectType,
    subjectId,
    order,
  });

  const results = applyLimit(filtered, limit);

  return res.json({
    success: true,
    updatedAt: store.updatedAt || nowIso(),
    filters: {
      type: type ?? null,
      subjectType: subjectType ?? null,
      subjectId: subjectId ?? null,
      order: order ?? "desc",
    },
    count: results.length,
    results,
    cached: loaded.cached,
    cacheAgeMs: loaded.cacheAgeMs,
  });
});

// FEED (alias of list)
router.get("/feed", async (req, res) => {
  // defaults: limit 20, desc
  const q = {
    ...req.query,
    limit: req.query?.limit ?? "20",
    order: req.query?.order ?? "desc",
  };
  req.query = q;
  return router.handle(req, res, () => {});
});

// Subject drilldown
router.get("/subject/:subjectType/:subjectId", async (req, res) => {
  const subjectType = normalizeStr(req.params.subjectType);
  const subjectId = normalizeStr(req.params.subjectId);
  const limit = req.query?.limit ?? "50";

  const loaded = await loadStore();
  const store = loaded.store;

  const filtered = filterAndSortItems(store.items, {
    type: null,
    subjectType,
    subjectId,
    order: "desc",
  });

  const results = applyLimit(filtered, limit);

  return res.json({
    success: true,
    updatedAt: store.updatedAt || nowIso(),
    subjectType,
    subjectId,
    count: results.length,
    results,
    cached: loaded.cached,
    cacheAgeMs: loaded.cacheAgeMs,
  });
});

// By ID
router.get("/id/:id", async (req, res) => {
  const id = normalizeStr(req.params.id);
  const loaded = await loadStore();
  const store = loaded.store;

  const found = (store.items || []).find((x) => normalizeStr(x?.id) === id) || null;
  if (!found) {
    return res.status(404).json({
      success: false,
      message: "Achievement not found.",
      id,
      updatedAt: store.updatedAt || nowIso(),
    });
  }

  return res.json({
    success: true,
    updatedAt: store.updatedAt || nowIso(),
    achievement: found,
    cached: loaded.cached,
    cacheAgeMs: loaded.cacheAgeMs,
  });
});

// -------------------- Backwards compat aliases --------------------

// /all -> /list
router.get("/all", async (req, res) => {
  req.url = "/list" + (req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "");
  return router.handle(req, res, () => {});
});

// /by-subject?subjectType=&subjectId=&limit=
router.get("/by-subject", async (req, res) => {
  const subjectType = normalizeStr(req.query?.subjectType);
  const subjectId = normalizeStr(req.query?.subjectId);
  if (!subjectType || !subjectId) {
    return res.status(400).json({
      success: false,
      message: "Missing required query params: subjectType, subjectId",
      updatedAt: nowIso(),
    });
  }

  req.params = { subjectType, subjectId };
  req.url = `/subject/${encodeURIComponent(subjectType)}/${encodeURIComponent(subjectId)}${
    req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : ""
  }`;
  return router.handle(req, res, () => {});
});

// IMPORTANT: root handler so /api/achievements?type=... works
router.get("/", async (req, res) => {
  req.url = "/list" + (req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "");
  return router.handle(req, res, () => {});
});

export default router;