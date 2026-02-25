// purchases.js
// iBand Backend — Purchases / Ownership / Subscriptions (Phase H1)
// Root-level router: mounted at /api/purchases
//
// Goals:
// - Track/album purchases + simple subscriptions (session-scoped for now)
// - Ownership state endpoint to power "⭐ Support Artist / 🎵 Buy Track / ✔ Owned / ▶ Play"
// - Future-proof: idempotency, dedupe keys, atomic writes, stable JSON
//
// Storage (Render-safe):
// - /var/data/iband/db/purchases.json
//
// Captain’s Protocol: full canonical file, no snippets, always JSON.

import fs from "fs";
import path from "path";
import crypto from "crypto";
import express from "express";

const router = express.Router();

// -------------------------
// Config
// -------------------------
const SERVICE = "purchases";
const VERSION = 1;

const DATA_DIR = process.env.IBAND_DATA_DIR || "/var/data/iband/db";
const PURCHASES_FILE = process.env.IBAND_PURCHASES_FILE || path.join(DATA_DIR, "purchases.json");

// cache
const CACHE_TTL_MS = clampInt(process.env.IBAND_PURCHASES_CACHE_TTL_MS, 15000, 0, 300000);

// limits
const MAX_LIST_LIMIT = clampInt(process.env.IBAND_PURCHASES_MAX_LIST, 100, 1, 500);

// pricing defaults (can be overridden later by Stripe)
const DEFAULTS = {
  currency: "GBP",
  trackPrice: 0.99,
  albumPrice: 6.99,
  subMonthlyPrice: 7.99,
  subYearlyPrice: 69.99,
};

// -------------------------
// Small utilities
// -------------------------
function nowIso() {
  return new Date().toISOString();
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function clampInt(v, fallback, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(clamp(n, min, max));
}

function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function ensureDir(p) {
  try {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e?.message || "EMKDIR" };
  }
}

function readJsonIfExists(p) {
  try {
    if (!fs.existsSync(p)) return { ok: false, value: null, error: "ENOENT" };
    const raw = fs.readFileSync(p, "utf8");
    const val = safeJsonParse(raw, null);
    if (!val || typeof val !== "object") return { ok: false, value: null, error: "EJSONPARSE" };
    return { ok: true, value: val, error: null };
  } catch (e) {
    return { ok: false, value: null, error: e?.message || "EREAD" };
  }
}

function writeJsonAtomic(p, obj) {
  const tmp = `${p}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, p);
}

function sha1(s) {
  return crypto.createHash("sha1").update(String(s || "")).digest("hex");
}

function normStr(s) {
  return String(s || "").trim();
}

function isPositiveMoney(n) {
  const x = Number(n);
  return Number.isFinite(x) && x >= 0;
}

// -------------------------
// In-memory cache (simple)
// -------------------------
const _cache = {
  at: 0,
  store: null,
};

function cacheGet() {
  if (!_cache.store) return null;
  const age = Date.now() - _cache.at;
  if (age > CACHE_TTL_MS) return null;
  return _cache.store;
}

function cacheSet(store) {
  _cache.store = store;
  _cache.at = Date.now();
}

function cacheClear() {
  _cache.store = null;
  _cache.at = 0;
}

// -------------------------
// Store shape
// -------------------------
// {
//   version: 1,
//   updatedAt: ISO,
//   items: [ purchaseRecord... ],
//   bySubject: { "fan:sess_123": [ids...] , "artist:abc": [ids...] },
//   subs: { "fan:sess_123": { plan:"monthly", active:true, startedAt, expiresAt } }
// }
//
// purchaseRecord:
// {
//   id, at,
//   type: "purchase" | "subscription",
//   productType: "track" | "album" | "sub_monthly" | "sub_yearly",
//   subjectType: "fan" | "user" | "artist",
//   subjectId: "sessionId|userId|artistId",
//   artistId?, trackId?, albumId?,
//   currency, amount,
//   status: "paid" | "refunded" | "void",
//   dedupeKey?,
//   meta?
// }

// -------------------------
// Load / Init store
// -------------------------
function defaultStore() {
  return {
    version: 1,
    updatedAt: null,
    items: [],
    bySubject: {},
    subs: {},
  };
}

function normalizeStore(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  if (!Number.isFinite(Number(s.version))) s.version = 1;
  if (!Array.isArray(s.items)) s.items = [];
  if (!s.bySubject || typeof s.bySubject !== "object") s.bySubject = {};
  if (!s.subs || typeof s.subs !== "object") s.subs = {};
  if (typeof s.updatedAt !== "string") s.updatedAt = null;
  return s;
}

function loadStore() {
  const cached = cacheGet();
  if (cached) return { ok: true, store: cached, cached: true, error: null };

  const dirOk = ensureDir(DATA_DIR);
  if (!dirOk.ok) return { ok: false, store: null, cached: false, error: dirOk.error };

  const r = readJsonIfExists(PURCHASES_FILE);
  if (!r.ok) {
    const s = defaultStore();
    cacheSet(s);
    return { ok: true, store: s, cached: false, error: r.error };
  }

  const s = normalizeStore(r.value);
  cacheSet(s);
  return { ok: true, store: s, cached: false, error: null };
}

function saveStore(store) {
  const dirOk = ensureDir(DATA_DIR);
  if (!dirOk.ok) return { ok: false, error: dirOk.error };

  const s = normalizeStore(store);
  s.updatedAt = nowIso();
  writeJsonAtomic(PURCHASES_FILE, s);
  cacheSet(s);
  return { ok: true, error: null };
}

function subjectKey(subjectType, subjectId) {
  return `${String(subjectType || "").toLowerCase()}:${String(subjectId || "").trim()}`;
}

function addToIndex(store, rec) {
  const key = subjectKey(rec.subjectType, rec.subjectId);
  if (!store.bySubject[key]) store.bySubject[key] = [];
  store.bySubject[key].push(rec.id);
}

function listForSubject(store, subjectType, subjectId) {
  const key = subjectKey(subjectType, subjectId);
  const ids = Array.isArray(store.bySubject[key]) ? store.bySubject[key] : [];
  const map = new Map(store.items.map((x) => [x.id, x]));
  return ids.map((id) => map.get(id)).filter(Boolean);
}

function findOwned(store, { subjectType, subjectId, productType, artistId, trackId, albumId }) {
  const list = listForSubject(store, subjectType, subjectId);
  return list.find((x) => {
    if (x.status !== "paid") return false;
    if (x.type !== "purchase") return false;
    if (x.productType !== productType) return false;
    if (productType === "track") {
      return x.artistId === artistId && x.trackId === trackId;
    }
    if (productType === "album") {
      return x.artistId === artistId && x.albumId === albumId;
    }
    return false;
  });
}

function getSub(store, subjectType, subjectId) {
  const key = subjectKey(subjectType, subjectId);
  const s = store.subs[key];
  if (!s || typeof s !== "object") return null;
  return s;
}

function isSubActive(sub) {
  if (!sub) return false;
  if (sub.active !== true) return false;
  if (!sub.expiresAt) return true;
  const exp = Date.parse(sub.expiresAt);
  if (!Number.isFinite(exp)) return true;
  return Date.now() < exp;
}

function computeDedupeKey(rec) {
  // stable: prevents duplicate purchases from repeated taps
  const core = [
    rec.type,
    rec.productType,
    rec.subjectType,
    rec.subjectId,
    rec.artistId || "",
    rec.trackId || "",
    rec.albumId || "",
    rec.currency || "",
    String(rec.amount ?? ""),
  ].join("|");
  return sha1(core);
}

// -------------------------
// Catalog (simple for Phase H1)
// -------------------------
function buildCatalog({ currency }) {
  const cur = currency || DEFAULTS.currency;
  return {
    currency: cur,
    products: [
      { id: "track_default", productType: "track", label: "Buy Track", amount: DEFAULTS.trackPrice, currency: cur },
      { id: "album_default", productType: "album", label: "Buy Album", amount: DEFAULTS.albumPrice, currency: cur },
      { id: "sub_monthly", productType: "sub_monthly", label: "Unlimited (Monthly)", amount: DEFAULTS.subMonthlyPrice, currency: cur },
      { id: "sub_yearly", productType: "sub_yearly", label: "Unlimited (Yearly)", amount: DEFAULTS.subYearlyPrice, currency: cur },
    ],
    note: "Phase H1 uses fixed prices. Stripe integration comes next.",
  };
}

// -------------------------
// Routes
// -------------------------

// Health
router.get("/health", (_req, res) => {
  const st = loadStore();
  const fileStat = (() => {
    try {
      if (!fs.existsSync(PURCHASES_FILE)) return { ok: false, error: "ENOENT", path: PURCHASES_FILE };
      const stat = fs.statSync(PURCHASES_FILE);
      return { ok: true, size: stat.size, mtimeMs: stat.mtimeMs, path: PURCHASES_FILE };
    } catch (e) {
      return { ok: false, error: e?.message || "ESTAT", path: PURCHASES_FILE };
    }
  })();

  res.json({
    success: true,
    service: SERVICE,
    version: VERSION,
    updatedAt: nowIso(),
    dataDir: DATA_DIR,
    file: fileStat,
    store: st.ok
      ? {
          version: st.store.version,
          updatedAt: st.store.updatedAt,
          items: st.store.items.length,
          subjectsIndexed: Object.keys(st.store.bySubject || {}).length,
          subs: Object.keys(st.store.subs || {}).length,
        }
      : null,
    cache: { ttlMs: CACHE_TTL_MS, cached: !!st.cached, cacheAgeMs: st.cached ? Date.now() - _cache.at : 0 },
  });
});

// Catalog
router.get("/catalog", (req, res) => {
  const currency = normStr(req.query.currency) || DEFAULTS.currency;
  res.json({
    success: true,
    updatedAt: nowIso(),
    catalog: buildCatalog({ currency }),
  });
});

// Subscription status (fan/session scope for now)
router.get("/subscription", (req, res) => {
  const subjectType = normStr(req.query.subjectType) || "fan";
  const subjectId = normStr(req.query.subjectId);
  if (!subjectId) {
    return res.status(400).json({ success: false, message: "Missing subjectId.", updatedAt: nowIso() });
  }

  const st = loadStore();
  if (!st.ok) return res.status(500).json({ success: false, message: "Store unavailable.", error: st.error, updatedAt: nowIso() });

  const sub = getSub(st.store, subjectType, subjectId);
  const active = isSubActive(sub);

  return res.json({
    success: true,
    updatedAt: nowIso(),
    subjectType,
    subjectId,
    subscription: sub
      ? {
          plan: sub.plan,
          active: active,
          startedAt: sub.startedAt || null,
          expiresAt: sub.expiresAt || null,
        }
      : { active: false },
  });
});

// Create/renew subscription (Phase H1 = mock, later = Stripe)
router.post("/subscribe", (req, res) => {
  const subjectType = normStr(req.body?.subjectType) || "fan";
  const subjectId = normStr(req.body?.subjectId);
  const plan = normStr(req.body?.plan) || "monthly"; // monthly|yearly

  if (!subjectId) {
    return res.status(400).json({ success: false, message: "Missing subjectId.", updatedAt: nowIso() });
  }
  if (!["monthly", "yearly"].includes(plan)) {
    return res.status(400).json({ success: false, message: "Invalid plan. Use monthly or yearly.", updatedAt: nowIso() });
  }

  const st = loadStore();
  if (!st.ok) return res.status(500).json({ success: false, message: "Store unavailable.", error: st.error, updatedAt: nowIso() });

  const key = subjectKey(subjectType, subjectId);
  const startedAt = nowIso();

  const expiresAt = (() => {
    const now = new Date();
    if (plan === "monthly") now.setMonth(now.getMonth() + 1);
    if (plan === "yearly") now.setFullYear(now.getFullYear() + 1);
    return now.toISOString();
  })();

  st.store.subs[key] = { plan, active: true, startedAt, expiresAt };

  // also record as an item (audit trail)
  const amount = plan === "monthly" ? DEFAULTS.subMonthlyPrice : DEFAULTS.subYearlyPrice;
  const rec = {
    id: `sub_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`,
    at: startedAt,
    type: "subscription",
    productType: plan === "monthly" ? "sub_monthly" : "sub_yearly",
    subjectType,
    subjectId,
    currency: DEFAULTS.currency,
    amount,
    status: "paid",
    meta: { phase: "H1-mock" },
  };
  rec.dedupeKey = computeDedupeKey(rec);
  st.store.items.push(rec);
  addToIndex(st.store, rec);

  const saved = saveStore(st.store);
  if (!saved.ok) return res.status(500).json({ success: false, message: "Failed saving store.", error: saved.error, updatedAt: nowIso() });

  return res.json({
    success: true,
    updatedAt: st.store.updatedAt || nowIso(),
    subjectType,
    subjectId,
    subscription: { plan, active: true, startedAt, expiresAt },
    recorded: true,
    item: { id: rec.id, type: rec.type, productType: rec.productType, amount: rec.amount, currency: rec.currency, status: rec.status },
  });
});

// Ownership state for a button on video UI
// Example: /state?subjectType=fan&subjectId=fan_test_power&artistId=kofi-sky&trackId=palm-street
router.get("/state", (req, res) => {
  const subjectType = normStr(req.query.subjectType) || "fan";
  const subjectId = normStr(req.query.subjectId);
  const artistId = normStr(req.query.artistId);
  const trackId = normStr(req.query.trackId);
  const albumId = normStr(req.query.albumId);

  if (!subjectId) return res.status(400).json({ success: false, message: "Missing subjectId.", updatedAt: nowIso() });
  if (!artistId) return res.status(400).json({ success: false, message: "Missing artistId.", updatedAt: nowIso() });

  const st = loadStore();
  if (!st.ok) return res.status(500).json({ success: false, message: "Store unavailable.", error: st.error, updatedAt: nowIso() });

  const sub = getSub(st.store, subjectType, subjectId);
  const subActive = isSubActive(sub);

  // subscription overrides ownership (unlimited access)
  if (subActive) {
    return res.json({
      success: true,
      updatedAt: nowIso(),
      subjectType,
      subjectId,
      artistId,
      trackId: trackId || null,
      albumId: albumId || null,
      mode: "subscription",
      button: {
        code: "play",
        label: "▶ Play",
        hint: "Unlimited access (subscription active).",
        canBuy: false,
      },
      subscription: { plan: sub.plan, active: true, expiresAt: sub.expiresAt || null },
    });
  }

  // track state if trackId provided, else album if albumId provided, else generic support
  let owned = null;
  if (trackId) {
    owned = findOwned(st.store, { subjectType, subjectId, productType: "track", artistId, trackId, albumId: null });
    if (owned) {
      return res.json({
        success: true,
        updatedAt: nowIso(),
        subjectType,
        subjectId,
        artistId,
        trackId,
        mode: "owned_track",
        button: { code: "owned", label: "✔ Owned", hint: "Track already purchased.", canBuy: false },
        owned: { id: owned.id, at: owned.at, amount: owned.amount, currency: owned.currency },
      });
    }
    return res.json({
      success: true,
      updatedAt: nowIso(),
      subjectType,
      subjectId,
      artistId,
      trackId,
      mode: "buy_track",
      button: { code: "buy_track", label: "⭐ Support Artist", hint: "Buy this track and support the artist.", canBuy: true },
      price: { amount: DEFAULTS.trackPrice, currency: DEFAULTS.currency },
    });
  }

  if (albumId) {
    owned = findOwned(st.store, { subjectType, subjectId, productType: "album", artistId, trackId: null, albumId });
    if (owned) {
      return res.json({
        success: true,
        updatedAt: nowIso(),
        subjectType,
        subjectId,
        artistId,
        albumId,
        mode: "owned_album",
        button: { code: "owned", label: "✔ Owned", hint: "Album already purchased.", canBuy: false },
        owned: { id: owned.id, at: owned.at, amount: owned.amount, currency: owned.currency },
      });
    }
    return res.json({
      success: true,
      updatedAt: nowIso(),
      subjectType,
      subjectId,
      artistId,
      albumId,
      mode: "buy_album",
      button: { code: "buy_album", label: "💿 Buy Album", hint: "Buy the full album.", canBuy: true },
      price: { amount: DEFAULTS.albumPrice, currency: DEFAULTS.currency },
    });
  }

  // fallback: generic support CTA
  return res.json({
    success: true,
    updatedAt: nowIso(),
    subjectType,
    subjectId,
    artistId,
    mode: "support",
    button: { code: "support", label: "⭐ Support Artist", hint: "Support this artist with a purchase.", canBuy: true },
    options: [
      { productType: "track", label: "Buy Track", amount: DEFAULTS.trackPrice, currency: DEFAULTS.currency },
      { productType: "album", label: "Buy Album", amount: DEFAULTS.albumPrice, currency: DEFAULTS.currency },
      { productType: "sub_monthly", label: "Unlimited (Monthly)", amount: DEFAULTS.subMonthlyPrice, currency: DEFAULTS.currency },
    ],
  });
});

// Buy endpoint (mock payment = recorded purchase)
// POST /buy { subjectType, subjectId, productType, artistId, trackId?, albumId?, amount?, currency?, meta? }
router.post("/buy", (req, res) => {
  const subjectType = normStr(req.body?.subjectType) || "fan";
  const subjectId = normStr(req.body?.subjectId);
  const productType = normStr(req.body?.productType); // track|album
  const artistId = normStr(req.body?.artistId);
  const trackId = normStr(req.body?.trackId);
  const albumId = normStr(req.body?.albumId);
  const currency = normStr(req.body?.currency) || DEFAULTS.currency;

  if (!subjectId) return res.status(400).json({ success: false, message: "Missing subjectId.", updatedAt: nowIso() });
  if (!artistId) return res.status(400).json({ success: false, message: "Missing artistId.", updatedAt: nowIso() });
  if (!["track", "album"].includes(productType)) {
    return res.status(400).json({ success: false, message: "Invalid productType. Use track or album.", updatedAt: nowIso() });
  }
  if (productType === "track" && !trackId) {
    return res.status(400).json({ success: false, message: "Missing trackId for track purchase.", updatedAt: nowIso() });
  }
  if (productType === "album" && !albumId) {
    return res.status(400).json({ success: false, message: "Missing albumId for album purchase.", updatedAt: nowIso() });
  }

  const priceDefault = productType === "track" ? DEFAULTS.trackPrice : DEFAULTS.albumPrice;
  const amount = isPositiveMoney(req.body?.amount) ? Number(req.body.amount) : priceDefault;

  const st = loadStore();
  if (!st.ok) return res.status(500).json({ success: false, message: "Store unavailable.", error: st.error, updatedAt: nowIso() });

  // prevent duplicates
  const existing = findOwned(st.store, { subjectType, subjectId, productType, artistId, trackId: trackId || null, albumId: albumId || null });
  if (existing) {
    return res.json({
      success: true,
      updatedAt: nowIso(),
      recorded: false,
      deduped: true,
      reason: "already-owned",
      purchase: { id: existing.id, at: existing.at, productType: existing.productType, amount: existing.amount, currency: existing.currency },
      stateHint: "Use /state to render ✔ Owned.",
    });
  }

  const at = nowIso();
  const rec = {
    id: `pur_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`,
    at,
    type: "purchase",
    productType,
    subjectType,
    subjectId,
    artistId,
    trackId: productType === "track" ? trackId : null,
    albumId: productType === "album" ? albumId : null,
    currency,
    amount,
    status: "paid",
    meta: req.body?.meta && typeof req.body.meta === "object" ? req.body.meta : { phase: "H1-mock" },
  };
  rec.dedupeKey = computeDedupeKey(rec);

  st.store.items.push(rec);
  addToIndex(st.store, rec);

  const saved = saveStore(st.store);
  if (!saved.ok) return res.status(500).json({ success: false, message: "Failed saving store.", error: saved.error, updatedAt: nowIso() });

  return res.json({
    success: true,
    updatedAt: st.store.updatedAt || nowIso(),
    recorded: true,
    deduped: false,
    purchase: {
      id: rec.id,
      at: rec.at,
      productType: rec.productType,
      subjectType: rec.subjectType,
      subjectId: rec.subjectId,
      artistId: rec.artistId,
      trackId: rec.trackId,
      albumId: rec.albumId,
      amount: rec.amount,
      currency: rec.currency,
      status: rec.status,
      dedupeKey: rec.dedupeKey,
    },
    next: {
      stateEndpoint: "/api/purchases/state",
      hint: "Call /state to render ✔ Owned / Buy Album / Subscribe etc.",
    },
  });
});

// List purchases (filters)
router.get("/list", (req, res) => {
  const type = normStr(req.query.type) || null; // purchase|subscription
  const subjectType = normStr(req.query.subjectType) || null;
  const subjectId = normStr(req.query.subjectId) || null;
  const artistId = normStr(req.query.artistId) || null;
  const productType = normStr(req.query.productType) || null;
  const order = normStr(req.query.order) || "desc";
  const limit = clampInt(req.query.limit, 20, 1, MAX_LIST_LIMIT);

  const st = loadStore();
  if (!st.ok) return res.status(500).json({ success: false, message: "Store unavailable.", error: st.error, updatedAt: nowIso() });

  let list = Array.isArray(st.store.items) ? [...st.store.items] : [];

  if (type) list = list.filter((x) => x.type === type);
  if (productType) list = list.filter((x) => x.productType === productType);
  if (artistId) list = list.filter((x) => x.artistId === artistId);
  if (subjectType) list = list.filter((x) => x.subjectType === subjectType);
  if (subjectId) list = list.filter((x) => x.subjectId === subjectId);

  list.sort((a, b) => (order === "asc" ? String(a.at).localeCompare(String(b.at)) : String(b.at).localeCompare(String(a.at))));
  list = list.slice(0, limit);

  return res.json({
    success: true,
    updatedAt: st.store.updatedAt || nowIso(),
    filters: { type, productType, subjectType, subjectId, artistId, order, limit },
    count: list.length,
    results: list.map((x) => ({
      id: x.id,
      at: x.at,
      type: x.type,
      productType: x.productType,
      subjectType: x.subjectType,
      subjectId: x.subjectId,
      artistId: x.artistId || null,
      trackId: x.trackId || null,
      albumId: x.albumId || null,
      amount: x.amount,
      currency: x.currency,
      status: x.status,
      dedupeKey: x.dedupeKey || null,
      meta: x.meta || null,
    })),
    cached: !!st.cached,
    cacheAgeMs: st.cached ? Date.now() - _cache.at : 0,
  });
});

// Clear cache (dev)
router.post("/cache/clear", (_req, res) => {
  cacheClear();
  res.json({ success: true, updatedAt: nowIso(), cleared: true });
});

export default router;