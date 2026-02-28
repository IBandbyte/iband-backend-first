// purchases.js
// iBand Backend — Purchases / Commerce Engine (v3)
// Root-level router: mounted at /api/purchases
//
// Captain’s Protocol: full canonical, future-proof, Render-safe, always JSON.
//
// Provides:
// - GET  /health
// - GET  /list
// - POST /record            ✅ (this fixes your "route not found")
// - GET  /id/:id
// - GET  /buyer/:buyerId
// - GET  /artist/:artistId
// - POST /subscribe
// - POST /cancel-subscription
// - GET  /subscriptions
// - GET  /summary

import fs from "fs";
import path from "path";
import crypto from "crypto";
import express from "express";

const router = express.Router();

// -------------------------
// Config
// -------------------------
const SERVICE = "purchases";
const VERSION = 3;

const DATA_DIR = process.env.IBAND_DATA_DIR || "/var/data/iband/db";
const PURCHASES_FILE = process.env.IBAND_PURCHASES_FILE || path.join(DATA_DIR, "purchases.json");
const ARTISTS_FILE = process.env.IBAND_ARTISTS_FILE || path.join(DATA_DIR, "artists.json");

const CACHE_TTL_MS = clampInt(process.env.IBAND_PURCHASES_CACHE_TTL_MS, 15000, 1000, 300000);

// -------------------------
// Tiny cache (in-memory)
// -------------------------
const cache = {
  atMs: 0,
  store: null,
};

// -------------------------
// Helpers
// -------------------------
function nowIso() {
  return new Date().toISOString();
}

function clampInt(v, def, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
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
    fs.mkdirSync(p, { recursive: true });
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
    if (!val) return { ok: false, value: null, error: "EJSONPARSE" };
    return { ok: true, value: val, error: null };
  } catch (e) {
    return { ok: false, value: null, error: e?.message || "EREAD" };
  }
}

function writeJsonAtomic(p, obj) {
  const dir = path.dirname(p);
  const mk = ensureDir(dir);
  if (!mk.ok) throw new Error(mk.error || "EMKDIR");

  const tmp = `${p}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, p);
}

function sha1(input) {
  return crypto.createHash("sha1").update(String(input)).digest("hex");
}

function normalizeStr(s) {
  return String(s || "").trim();
}

function pickOrder(order) {
  const o = String(order || "desc").toLowerCase();
  return o === "asc" ? "asc" : "desc";
}

function limitInt(v, def, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

// -------------------------
// Store shape
// -------------------------
function blankStore() {
  return {
    version: 1,
    updatedAt: null,
    items: [], // purchases + subscriptions
    index: {
      byId: {},
      byBuyer: {}, // buyerId -> [id...]
      byArtist: {}, // artistId -> [id...]
      bySubscriber: {}, // subscriberId -> [id...]
      byDedupeKey: {}, // dedupeKey -> id
      subsBySubscriber: {}, // subscriberId -> activeSubId (best effort)
    },
  };
}

function isCacheValid() {
  return cache.store && Date.now() - cache.atMs <= CACHE_TTL_MS;
}

function setCache(store) {
  cache.store = store;
  cache.atMs = Date.now();
}

function clearCache() {
  cache.store = null;
  cache.atMs = 0;
}

function rebuildIndexes(store) {
  const st = store && typeof store === "object" ? store : blankStore();
  if (!Array.isArray(st.items)) st.items = [];

  st.index = {
    byId: {},
    byBuyer: {},
    byArtist: {},
    bySubscriber: {},
    byDedupeKey: {},
    subsBySubscriber: {},
  };

  for (const item of st.items) {
    const id = String(item?.id || "");
    if (!id) continue;
    st.index.byId[id] = true;

    const buyerId = normalizeStr(item?.buyerId);
    const artistId = normalizeStr(item?.artistId);
    const subscriberId = normalizeStr(item?.subscriberId);
    const dedupeKey = normalizeStr(item?.dedupeKey);

    if (buyerId) {
      if (!st.index.byBuyer[buyerId]) st.index.byBuyer[buyerId] = [];
      st.index.byBuyer[buyerId].push(id);
    }
    if (artistId) {
      if (!st.index.byArtist[artistId]) st.index.byArtist[artistId] = [];
      st.index.byArtist[artistId].push(id);
    }
    if (subscriberId) {
      if (!st.index.bySubscriber[subscriberId]) st.index.bySubscriber[subscriberId] = [];
      st.index.bySubscriber[subscriberId].push(id);
    }
    if (dedupeKey) {
      if (!st.index.byDedupeKey[dedupeKey]) st.index.byDedupeKey[dedupeKey] = id;
    }

    if (String(item?.kind) === "subscription" && subscriberId) {
      const status = String(item?.status || "active");
      if (status === "active") st.index.subsBySubscriber[subscriberId] = id;
    }
  }

  return st;
}

function loadStore() {
  if (isCacheValid()) return { ok: true, store: cache.store, cached: true, cacheAgeMs: Date.now() - cache.atMs };

  const r = readJsonIfExists(PURCHASES_FILE);
  if (!r.ok) {
    const st = blankStore();
    setCache(st);
    return { ok: true, store: st, cached: false, cacheAgeMs: 0, created: true, fileError: r.error };
  }

  const raw = r.value;
  const st = rebuildIndexes(raw && typeof raw === "object" ? raw : blankStore());
  setCache(st);

  return { ok: true, store: st, cached: false, cacheAgeMs: 0, created: false, fileError: null };
}

function saveStore(store) {
  const st = rebuildIndexes(store);
  st.updatedAt = nowIso();
  writeJsonAtomic(PURCHASES_FILE, st);
  setCache(st);
  return st;
}

function statFile(p) {
  try {
    const s = fs.statSync(p);
    return { ok: true, size: s.size, mtimeMs: s.mtimeMs, path: p };
  } catch (e) {
    return { ok: false, error: e?.code || e?.message || "ESTAT", path: p };
  }
}

function loadArtistsMeta() {
  const r = readJsonIfExists(ARTISTS_FILE);
  if (!r.ok) return { ok: false, artistsLoaded: 0, error: r.error };

  // wrapper-aware
  const parsed = r.value;
  let arr = [];
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && typeof parsed === "object") {
    if (Array.isArray(parsed.artists)) arr = parsed.artists;
    else if (Array.isArray(parsed.data)) arr = parsed.data;
    else if (Array.isArray(parsed.items)) arr = parsed.items;
    else if (parsed.artists && typeof parsed.artists === "object") arr = Object.values(parsed.artists);
    else arr = Object.values(parsed).filter((x) => x && typeof x === "object");
  }

  const artistsLoaded = arr.filter((a) => a && a.id).length;
  return { ok: true, artistsLoaded, error: null };
}

// -------------------------
// Validation + creation
// -------------------------
function makeId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}

function computeDedupeKey(payload) {
  // Dedupe over a short logical set so “double taps” don’t duplicate purchases.
  const kind = normalizeStr(payload?.kind);
  const buyerId = normalizeStr(payload?.buyerId);
  const subscriberId = normalizeStr(payload?.subscriberId);
  const artistId = normalizeStr(payload?.artistId);
  const trackId = normalizeStr(payload?.trackId);
  const albumId = normalizeStr(payload?.albumId);
  const amountMinor = Number(payload?.amountMinor || 0) || 0;
  const currency = normalizeStr(payload?.currency || "");
  const source = normalizeStr(payload?.source || "");

  return sha1(JSON.stringify({ kind, buyerId, subscriberId, artistId, trackId, albumId, amountMinor, currency, source }));
}

function validatePurchasePayload(body) {
  const kind = normalizeStr(body?.kind);
  if (!kind) return { ok: false, message: "Invalid payload: kind is required." };

  if (kind !== "purchase" && kind !== "subscription") {
    return { ok: false, message: "Invalid payload: kind must be 'purchase' or 'subscription'." };
  }

  if (kind === "purchase") {
    const buyerId = normalizeStr(body?.buyerId);
    const artistId = normalizeStr(body?.artistId);
    if (!buyerId) return { ok: false, message: "Invalid purchase payload: buyerId is required." };
    if (!artistId) return { ok: false, message: "Invalid purchase payload: artistId is required." };

    const amountMinor = Number(body?.amountMinor || 0);
    if (!Number.isFinite(amountMinor) || amountMinor < 0) {
      return { ok: false, message: "Invalid purchase payload: amountMinor must be a number >= 0." };
    }

    return { ok: true };
  }

  // subscription
  const subscriberId = normalizeStr(body?.subscriberId);
  if (!subscriberId) return { ok: false, message: "Invalid subscription payload: subscriberId is required." };

  const plan = normalizeStr(body?.plan || "iband_unlimited");
  const amountMinor = Number(body?.amountMinor || 0);
  if (!Number.isFinite(amountMinor) || amountMinor < 0) {
    return { ok: false, message: "Invalid subscription payload: amountMinor must be a number >= 0." };
  }

  return { ok: true, plan };
}

function addItemToStore(store, item, { allowDedupe = true } = {}) {
  const st = rebuildIndexes(store);

  const dedupeKey = normalizeStr(item?.dedupeKey);
  if (allowDedupe && dedupeKey && st.index.byDedupeKey[dedupeKey]) {
    const existingId = st.index.byDedupeKey[dedupeKey];
    const existing = st.items.find((x) => x.id === existingId) || null;
    return { saved: false, deduped: true, item: existing };
  }

  st.items.push(item);
  const saved = saveStore(st);
  const storedItem = saved.items.find((x) => x.id === item.id) || item;

  return { saved: true, deduped: false, item: storedItem };
}

// -------------------------
// Queries
// -------------------------
function listItems(store, filters) {
  const kind = normalizeStr(filters?.kind);
  const buyerId = normalizeStr(filters?.buyerId);
  const subscriberId = normalizeStr(filters?.subscriberId);
  const artistId = normalizeStr(filters?.artistId);
  const order = pickOrder(filters?.order);
  const limit = limitInt(filters?.limit, 50, 1, 200);

  let arr = Array.isArray(store?.items) ? [...store.items] : [];

  if (kind) arr = arr.filter((x) => String(x?.kind) === kind);
  if (buyerId) arr = arr.filter((x) => normalizeStr(x?.buyerId) === buyerId);
  if (subscriberId) arr = arr.filter((x) => normalizeStr(x?.subscriberId) === subscriberId);
  if (artistId) arr = arr.filter((x) => normalizeStr(x?.artistId) === artistId);

  arr.sort((a, b) => {
    const ta = Date.parse(a?.at || "") || 0;
    const tb = Date.parse(b?.at || "") || 0;
    return order === "asc" ? ta - tb : tb - ta;
  });

  return arr.slice(0, limit);
}

// -------------------------
// Endpoints
// -------------------------
router.get("/health", (_req, res) => {
  const st = loadStore();
  const artists = loadArtistsMeta();

  const fileStat = statFile(PURCHASES_FILE);

  res.json({
    success: true,
    service: SERVICE,
    version: VERSION,
    updatedAt: nowIso(),
    dataDir: DATA_DIR,
    file: fileStat,
    store: {
      version: st.store?.version ?? 1,
      updatedAt: st.store?.updatedAt ?? null,
      items: Array.isArray(st.store?.items) ? st.store.items.length : 0,
      subjectsIndexed: st.store?.index ? Object.keys(st.store.index.byBuyer || {}).length : null,
      subs: st.store?.index ? Object.keys(st.store.index.subsBySubscriber || {}).length : 0,
    },
    artists,
    cache: {
      ttlMs: CACHE_TTL_MS,
      cached: !!st.cached,
      cacheAgeMs: st.cacheAgeMs || 0,
    },
  });
});

router.get("/list", (req, res) => {
  const st = loadStore();

  const kind = normalizeStr(req.query.kind);
  const buyerId = normalizeStr(req.query.buyerId);
  const subscriberId = normalizeStr(req.query.subscriberId);
  const artistId = normalizeStr(req.query.artistId);
  const order = pickOrder(req.query.order);
  const limit = limitInt(req.query.limit, 50, 1, 200);

  const results = listItems(st.store, { kind, buyerId, subscriberId, artistId, order, limit });

  res.json({
    success: true,
    updatedAt: st.store?.updatedAt || nowIso(),
    filters: { kind: kind || null, buyerId: buyerId || null, subscriberId: subscriberId || null, artistId: artistId || null, order },
    count: results.length,
    results,
    cached: !!st.cached,
    cacheAgeMs: st.cacheAgeMs || 0,
  });
});

// ✅ This is the missing endpoint you hit
router.post("/record", (req, res) => {
  const body = req.body || {};
  const v = validatePurchasePayload(body);
  if (!v.ok) {
    return res.status(400).json({ success: false, message: v.message, updatedAt: nowIso() });
  }

  const st = loadStore();

  const kind = normalizeStr(body.kind);
  const at = nowIso();

  const base = {
    id: makeId("pur"),
    at,
    kind,
    currency: normalizeStr(body.currency || "GBP"),
    amountMinor: Number(body.amountMinor || 0) || 0,
    source: normalizeStr(body.source || "unknown"),
    meta: body.meta && typeof body.meta === "object" ? body.meta : null,
    v: 1,
  };

  let item = null;

  if (kind === "purchase") {
    item = {
      ...base,
      buyerId: normalizeStr(body.buyerId),
      artistId: normalizeStr(body.artistId),
      trackId: normalizeStr(body.trackId) || null,
      albumId: normalizeStr(body.albumId) || null,
      productType: normalizeStr(body.productType || (body.albumId ? "album" : "track")) || "track",
      status: "paid",
    };
  } else {
    // subscription
    item = {
      ...base,
      id: makeId("sub"),
      subscriberId: normalizeStr(body.subscriberId),
      plan: normalizeStr(body.plan || "iband_unlimited"),
      status: normalizeStr(body.status || "active"),
      period: normalizeStr(body.period || "monthly"),
      renewsAt: body.renewsAt ? String(body.renewsAt) : null,
      cancelAt: body.cancelAt ? String(body.cancelAt) : null,
    };
  }

  const dedupeKey = normalizeStr(body.dedupeKey) || computeDedupeKey(item);
  item.dedupeKey = dedupeKey;

  const saved = addItemToStore(st.store, item, { allowDedupe: true });

  return res.json({
    success: true,
    updatedAt: nowIso(),
    recorded: saved.saved,
    deduped: saved.deduped,
    item: saved.item,
  });
});

router.get("/id/:id", (req, res) => {
  const st = loadStore();
  const id = normalizeStr(req.params.id);

  const found = (st.store?.items || []).find((x) => String(x?.id) === id) || null;

  res.json({
    success: true,
    updatedAt: st.store?.updatedAt || nowIso(),
    id,
    found: !!found,
    item: found,
  });
});

router.get("/buyer/:buyerId", (req, res) => {
  const st = loadStore();
  const buyerId = normalizeStr(req.params.buyerId);
  const limit = limitInt(req.query.limit, 50, 1, 200);
  const order = pickOrder(req.query.order);

  const results = listItems(st.store, { kind: "purchase", buyerId, order, limit });

  res.json({
    success: true,
    updatedAt: st.store?.updatedAt || nowIso(),
    buyerId,
    count: results.length,
    results,
  });
});

router.get("/artist/:artistId", (req, res) => {
  const st = loadStore();
  const artistId = normalizeStr(req.params.artistId);
  const limit = limitInt(req.query.limit, 50, 1, 200);
  const order = pickOrder(req.query.order);

  const results = listItems(st.store, { kind: "purchase", artistId, order, limit });

  res.json({
    success: true,
    updatedAt: st.store?.updatedAt || nowIso(),
    artistId,
    count: results.length,
    results,
  });
});

router.post("/subscribe", (req, res) => {
  const body = req.body || {};
  body.kind = "subscription";

  const v = validatePurchasePayload(body);
  if (!v.ok) {
    return res.status(400).json({ success: false, message: v.message, updatedAt: nowIso() });
  }

  // Default monthly sub (future-proof fields)
  const now = new Date();
  const renew = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const payload = {
    ...body,
    plan: normalizeStr(body.plan || "iband_unlimited"),
    status: normalizeStr(body.status || "active"),
    period: normalizeStr(body.period || "monthly"),
    renewsAt: body.renewsAt || renew.toISOString(),
    amountMinor: Number(body.amountMinor || 0) || 0,
    currency: normalizeStr(body.currency || "GBP"),
    source: normalizeStr(body.source || "demo"),
  };

  // reuse record logic
  req.body = payload;
  return router.handle(req, res);
});

router.post("/cancel-subscription", (req, res) => {
  const st = loadStore();
  const subscriberId = normalizeStr(req.body?.subscriberId);
  if (!subscriberId) {
    return res.status(400).json({ success: false, message: "subscriberId is required.", updatedAt: nowIso() });
  }

  const items = Array.isArray(st.store?.items) ? [...st.store.items] : [];
  const active = items
    .filter((x) => String(x?.kind) === "subscription")
    .filter((x) => normalizeStr(x?.subscriberId) === subscriberId)
    .filter((x) => String(x?.status) === "active")
    .sort((a, b) => (Date.parse(b?.at || "") || 0) - (Date.parse(a?.at || "") || 0))[0];

  if (!active) {
    return res.json({
      success: true,
      updatedAt: nowIso(),
      subscriberId,
      cancelled: false,
      message: "No active subscription found.",
    });
  }

  active.status = "cancelled";
  active.cancelAt = nowIso();

  const nextStore = { ...st.store, items };
  saveStore(nextStore);

  return res.json({
    success: true,
    updatedAt: nowIso(),
    subscriberId,
    cancelled: true,
    subscriptionId: active.id,
    item: active,
  });
});

router.get("/subscriptions", (req, res) => {
  const st = loadStore();
  const subscriberId = normalizeStr(req.query.subscriberId);
  const order = pickOrder(req.query.order);
  const limit = limitInt(req.query.limit, 50, 1, 200);

  const results = listItems(st.store, { kind: "subscription", subscriberId: subscriberId || null, order, limit });

  res.json({
    success: true,
    updatedAt: st.store?.updatedAt || nowIso(),
    filters: { subscriberId: subscriberId || null, order },
    count: results.length,
    results,
  });
});

router.get("/summary", (_req, res) => {
  const st = loadStore();
  const items = Array.isArray(st.store?.items) ? st.store.items : [];

  const purchases = items.filter((x) => String(x?.kind) === "purchase");
  const subs = items.filter((x) => String(x?.kind) === "subscription");

  const revenueMinor = purchases.reduce((acc, x) => acc + (Number(x?.amountMinor || 0) || 0), 0);
  const activeSubs = subs.filter((x) => String(x?.status) === "active").length;

  res.json({
    success: true,
    updatedAt: st.store?.updatedAt || nowIso(),
    counts: {
      items: items.length,
      purchases: purchases.length,
      subscriptions: subs.length,
      activeSubscriptions: activeSubs,
    },
    revenue: {
      currency: "mixed",
      totalAmountMinor: revenueMinor,
    },
  });
});

export default router;