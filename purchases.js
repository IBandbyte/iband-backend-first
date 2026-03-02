// purchases.js
// iBand Backend — Purchases / Subscriptions / Ownership (Phase H3 — Monetisation Signals)
// Root-level router: mounted at /api/purchases (and alias /api/commerce if you choose)
//
// Captain’s Protocol:
// - Full canonical file (no snippets)
// - Future-proof endpoints
// - Render-safe
// - Always JSON
//
// What this file does (H2 + H3):
// - purchases.json persistent store (auto-created)
// - Record purchase + subscription events
// - Ownership lookup
// - Intelligence endpoint (UI decisions: purchased/buy/sub/stream)
// - Monetisation Signals (artist revenue, supporter count, fan spend, subscription status)
// - Emit events into events.jsonl (so ranking / flash medals / recs can react later)
// - Best-effort write into achievements.json (if achievements engine is present)
//
// NOTE: Still no Stripe/real payments yet. This is a "ledger + signals + events" layer.
// Stripe/crypto providers can be wired later without changing the API surface.

import fs from "fs";
import path from "path";
import crypto from "crypto";
import express from "express";

const router = express.Router();

// -------------------------
// Config
// -------------------------
const SERVICE = "purchases";
const VERSION = 4; // Phase H3 Monetisation Signals

const DATA_DIR = process.env.IBAND_DATA_DIR || "/var/data/iband/db";

const PURCHASES_FILE = process.env.IBAND_PURCHASES_FILE || path.join(DATA_DIR, "purchases.json");
const EVENTS_LOG = process.env.IBAND_EVENTS_LOG || path.join(DATA_DIR, "events.jsonl");
const ARTISTS_FILE = process.env.IBAND_ARTISTS_FILE || path.join(DATA_DIR, "artists.json");

// Optional integration: achievements store (best-effort)
const ACHIEVEMENTS_FILE = process.env.IBAND_ACHIEVEMENTS_FILE || path.join(DATA_DIR, "achievements.json");

// Safety / limits
const DEFAULTS = {
  cacheTtlMs: 15000,
  maxReturn: 50,

  // Purchase rules (soft)
  maxQtyPerPurchase: 50,

  // Subscription defaults
  defaultSubPeriodDays: 30,
  maxSubPeriodDays: 365,

  // Signals windows
  defaultWindowDays: 30,
  maxWindowDays: 365,

  // Events tail
  tailKb: 512,
  maxLines: 3000,

  // Supporter tiers (purely cosmetic; helps UI + future perks)
  supporter: {
    earlySpend: 0.01,
    earlyCount: 1,
    bronzeSpend: 10,
    bronzeCount: 3,
    silverSpend: 25,
    silverCount: 5,
    goldSpend: 50,
    goldCount: 10,
  },
};

// In-memory cache for store reads
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

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
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
  const tmp = `${p}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, p);
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}

function sha1(s) {
  return crypto.createHash("sha1").update(String(s)).digest("hex");
}

function normalizeStr(s) {
  return String(s || "").trim();
}

function isNonEmpty(s) {
  return !!normalizeStr(s);
}

function asMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return 0;
  return Math.round(x * 100) / 100;
}

function asInt(n, def = 0) {
  const x = Number(n);
  if (!Number.isFinite(x)) return def;
  return Math.trunc(x);
}

function toMsDays(days) {
  return Number(days) * 24 * 60 * 60 * 1000;
}

function parseDateMs(iso) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function ensureStore() {
  const now = Date.now();
  if (cache.store && now - cache.atMs < DEFAULTS.cacheTtlMs) {
    return { ok: true, store: cache.store, cached: true };
  }

  const dirOk = ensureDir(DATA_DIR);
  if (!dirOk.ok) return { ok: false, error: dirOk.error, store: null, cached: false };

  const r = readJsonIfExists(PURCHASES_FILE);
  if (!r.ok) {
    const initial = { version: 1, updatedAt: null, purchases: [], subs: [] };
    try {
      writeJsonAtomic(PURCHASES_FILE, initial);
      cache.store = initial;
      cache.atMs = now;
      return { ok: true, store: initial, cached: false, created: true };
    } catch (e) {
      return { ok: false, error: e?.message || "EWRITE_INIT", store: null, cached: false };
    }
  }

  const v = r.value && typeof r.value === "object" ? r.value : null;
  if (!v) return { ok: false, error: "EBAD_STORE", store: null, cached: false };

  if (!Array.isArray(v.purchases)) v.purchases = [];
  if (!Array.isArray(v.subs)) v.subs = [];
  if (!("version" in v)) v.version = 1;

  cache.store = v;
  cache.atMs = now;
  return { ok: true, store: v, cached: false };
}

function persistStore(store) {
  store.updatedAt = nowIso();
  writeJsonAtomic(PURCHASES_FILE, store);
  cache.store = store;
  cache.atMs = Date.now();
}

function appendJsonl(filePath, obj) {
  try {
    ensureDir(path.dirname(filePath));
    fs.appendFileSync(filePath, `${JSON.stringify(obj)}\n`, "utf8");
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e?.message || "EAPPEND" };
  }
}

function loadArtistsIndex() {
  const r = readJsonIfExists(ARTISTS_FILE);
  if (!r.ok) return { ok: false, artistsById: {}, artistsLoaded: 0, error: r.error };

  const parsed = r.value;
  let arr = [];
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && typeof parsed === "object") {
    if (Array.isArray(parsed.artists)) arr = parsed.artists;
    else if (Array.isArray(parsed.items)) arr = parsed.items;
    else if (Array.isArray(parsed.results)) arr = parsed.results;
  }

  const artistsById = {};
  for (const a of arr) {
    const id = normalizeStr(a?.id);
    if (!id) continue;
    artistsById[id] = {
      id,
      name: a?.name ?? null,
      genre: a?.genre ?? null,
      location: a?.location ?? null,
      imageUrl: a?.imageUrl ?? null,
    };
  }

  return { ok: true, artistsById, artistsLoaded: Object.keys(artistsById).length, error: null };
}

function bestEffortWriteAchievement(payload) {
  try {
    if (!fs.existsSync(ACHIEVEMENTS_FILE)) return { ok: false, skipped: true, reason: "ACH_FILE_MISSING" };
    const r = readJsonIfExists(ACHIEVEMENTS_FILE);
    if (!r.ok) return { ok: false, skipped: true, reason: r.error };

    const store = r.value && typeof r.value === "object" ? r.value : null;
    if (!store) return { ok: false, skipped: true, reason: "ACH_BAD_STORE" };

    if (!Array.isArray(store.items)) store.items = [];
    if (!store.version) store.version = 1;

    const ach = {
      id: makeId("ach"),
      at: nowIso(),
      type: "achievement",
      subjectType: payload.subjectType,
      subjectId: payload.subjectId,
      medal: payload.medal ?? null,
      title: payload.title ?? null,
      message: payload.message ?? null,
      stats: payload.stats ?? null,
      subject: payload.subject ?? null,
      meta: payload.meta ?? null,
      v: 1,
      dedupeKey: sha1(`${payload.subjectType}:${payload.subjectId}:${payload.message || ""}`),
    };

    store.items.push(ach);
    store.updatedAt = ach.at;

    writeJsonAtomic(ACHIEVEMENTS_FILE, store);
    return { ok: true, skipped: false, achievementId: ach.id };
  } catch (e) {
    return { ok: false, skipped: true, reason: e?.message || "EACH_WRITE" };
  }
}

function computeSupporterLevel(spend, count) {
  const t = DEFAULTS.supporter;
  if (spend >= t.goldSpend || count >= t.goldCount) return "gold-supporter";
  if (spend >= t.silverSpend || count >= t.silverCount) return "silver-supporter";
  if (spend >= t.bronzeSpend || count >= t.bronzeCount) return "bronze-supporter";
  if (spend >= t.earlySpend || count >= t.earlyCount) return "early-supporter";
  return "none";
}

function isActiveSub(sub) {
  if (!sub || sub.status !== "active") return false;
  const e = parseDateMs(sub.endsAt);
  return e !== null && e > Date.now();
}

// Monetisation Signals (core)
function calcSignals(store, opts) {
  const windowDays = clamp(asInt(opts.windowDays, DEFAULTS.defaultWindowDays), 1, DEFAULTS.maxWindowDays);
  const sinceMs = Date.now() - toMsDays(windowDays);

  const purchases = Array.isArray(store.purchases) ? store.purchases : [];
  const subs = Array.isArray(store.subs) ? store.subs : [];

  // Index by artist + buyer
  const artist = {};
  const fan = {};

  for (const p of purchases) {
    if (!p || p.type !== "purchase") continue;
    const atMs = parseDateMs(p.at);
    if (atMs === null || atMs < sinceMs) continue;

    const artistId = normalizeStr(p.artistId);
    const buyerId = normalizeStr(p.buyerId);

    if (artistId) {
      if (!artist[artistId]) {
        artist[artistId] = {
          revenueGross: 0,
          revenueNet: 0,
          platformFees: 0,
          purchases: 0,
          qty: 0,
          uniqueBuyers: new Set(),
          lastAt: null,
        };
      }
      artist[artistId].revenueGross += Number(p.amount || 0) || 0;
      artist[artistId].revenueNet += Number(p.artistNet || 0) || 0;
      artist[artistId].platformFees += Number(p.platformFee || 0) || 0;
      artist[artistId].purchases += 1;
      artist[artistId].qty += Number(p.qty || 0) || 0;
      if (buyerId) artist[artistId].uniqueBuyers.add(buyerId);
      artist[artistId].lastAt = p.at || artist[artistId].lastAt;
    }

    if (buyerId) {
      if (!fan[buyerId]) {
        fan[buyerId] = {
          spend: 0,
          purchases: 0,
          uniqueArtists: new Set(),
          lastAt: null,
        };
      }
      fan[buyerId].spend += Number(p.amount || 0) || 0;
      fan[buyerId].purchases += 1;
      if (artistId) fan[buyerId].uniqueArtists.add(artistId);
      fan[buyerId].lastAt = p.at || fan[buyerId].lastAt;
    }
  }

  // Active subscriptions (not windowed; “active now” matters)
  const activeSubsByFan = {};
  const activeSubsByArtist = {};
  for (const s of subs) {
    if (!isActiveSub(s)) continue;
    const subscriberId = normalizeStr(s.subscriberId);
    const artistId = normalizeStr(s.artistId || "");

    if (subscriberId) {
      if (!activeSubsByFan[subscriberId]) activeSubsByFan[subscriberId] = [];
      activeSubsByFan[subscriberId].push(s);
    }

    if (artistId) {
      if (!activeSubsByArtist[artistId]) activeSubsByArtist[artistId] = [];
      activeSubsByArtist[artistId].push(s);
    }
  }

  // Finalize sets
  for (const k of Object.keys(artist)) {
    artist[k].uniqueBuyersCount = artist[k].uniqueBuyers.size;
    delete artist[k].uniqueBuyers;
    artist[k].revenueGross = asMoney(artist[k].revenueGross);
    artist[k].revenueNet = asMoney(artist[k].revenueNet);
    artist[k].platformFees = asMoney(artist[k].platformFees);
  }
  for (const k of Object.keys(fan)) {
    fan[k].uniqueArtistsCount = fan[k].uniqueArtists.size;
    delete fan[k].uniqueArtists;
    fan[k].spend = asMoney(fan[k].spend);
  }

  return {
    windowDays,
    sinceAt: new Date(sinceMs).toISOString(),
    artist,
    fan,
    activeSubsByFan,
    activeSubsByArtist,
  };
}

// -------------------------
// Health
// -------------------------
router.get("/health", (_req, res) => {
  const st = readJsonIfExists(PURCHASES_FILE);
  const store = ensureStore();
  const artists = loadArtistsIndex();

  res.json({
    success: true,
    service: SERVICE,
    version: VERSION,
    updatedAt: nowIso(),
    dataDir: DATA_DIR,
    file: st.ok
      ? {
          ok: true,
          size: (() => {
            try {
              return fs.statSync(PURCHASES_FILE).size;
            } catch {
              return null;
            }
          })(),
          mtimeMs: (() => {
            try {
              return fs.statSync(PURCHASES_FILE).mtimeMs;
            } catch {
              return null;
            }
          })(),
          path: PURCHASES_FILE,
        }
      : { ok: false, error: st.error, path: PURCHASES_FILE },
    store: store.ok
      ? {
          version: store.store.version || 1,
          updatedAt: store.store.updatedAt || null,
          items: Array.isArray(store.store.purchases) ? store.store.purchases.length : 0,
          subjectsIndexed: null,
          subs: Array.isArray(store.store.subs) ? store.store.subs.length : 0,
        }
      : null,
    artists: { ok: artists.ok, artistsLoaded: artists.artistsLoaded, error: artists.error },
    cache: { ttlMs: DEFAULTS.cacheTtlMs, cached: !!store.cached, cacheAgeMs: Date.now() - cache.atMs },
  });
});

// -------------------------
// POST /purchase
// Records a purchase (track/album/merch/ticket/tip)
// -------------------------
router.post("/purchase", express.json({ limit: "200kb" }), (req, res) => {
  const body = req.body || {};

  const buyerType = normalizeStr(body.buyerType || "fan");
  const buyerId = normalizeStr(body.buyerId || body.sessionId || "anon");

  const artistId = normalizeStr(body.artistId || "");
  const itemType = normalizeStr(body.itemType || "track"); // track|album|ticket|merch|tip
  const itemId = normalizeStr(body.itemId || "");
  const qty = clamp(asInt(body.qty, 1), 1, DEFAULTS.maxQtyPerPurchase);

  const currency = normalizeStr(body.currency || "GBP").toUpperCase();
  const amount = asMoney(body.amount || 0);
  const platformFeePct = clamp(Number(body.platformFeePct ?? 10), 0, 50);
  const platformFee = asMoney((amount * platformFeePct) / 100);
  const artistNet = asMoney(Math.max(0, amount - platformFee));

  const sessionId = normalizeStr(body.sessionId || "");
  const meta = body.meta && typeof body.meta === "object" ? body.meta : null;

  if (!isNonEmpty(buyerId)) return res.status(400).json({ success: false, message: "Invalid purchase payload. buyerId/sessionId required.", updatedAt: nowIso() });
  if (!isNonEmpty(artistId)) return res.status(400).json({ success: false, message: "Invalid purchase payload. artistId required.", updatedAt: nowIso() });
  if (!isNonEmpty(itemId)) return res.status(400).json({ success: false, message: "Invalid purchase payload. itemId required.", updatedAt: nowIso() });
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: "Invalid purchase payload. amount must be > 0.", updatedAt: nowIso() });

  const storeLoad = ensureStore();
  if (!storeLoad.ok) return res.status(500).json({ success: false, message: "Purchases store not available.", error: storeLoad.error, updatedAt: nowIso() });

  const artists = loadArtistsIndex();
  const artist = artists.artistsById?.[artistId] || { id: artistId, name: null, genre: null, location: null, imageUrl: null };

  const at = nowIso();
  const id = makeId("pur");

  const dedupeKey = sha1(`${buyerType}:${buyerId}:${artistId}:${itemType}:${itemId}:${qty}:${currency}:${amount}`);
  const dedupeWindowMs = 2 * 60 * 1000;
  const nowMs = Date.now();

  const lastDup = (storeLoad.store.purchases || [])
    .slice(-50)
    .find((p) => p && p.dedupeKey === dedupeKey && Number.isFinite(Date.parse(p.at)) && nowMs - Date.parse(p.at) <= dedupeWindowMs);

  if (lastDup) {
    return res.json({
      success: true,
      updatedAt: storeLoad.store.updatedAt || at,
      recorded: false,
      deduped: true,
      purchase: lastDup,
    });
  }

  const purchase = {
    id,
    at,
    type: "purchase",
    buyerType,
    buyerId,
    sessionId: sessionId || null,

    artistId,
    itemType,
    itemId,
    qty,

    currency,
    amount,
    platformFeePct,
    platformFee,
    artistNet,

    status: "captured",
    provider: body.provider ? normalizeStr(body.provider) : "ledger",
    providerRef: body.providerRef ? normalizeStr(body.providerRef) : null,

    meta,
    v: 1,
    dedupeKey,
  };

  storeLoad.store.purchases.push(purchase);
  persistStore(storeLoad.store);

  const event = {
    id: makeId("evt"),
    at,
    type: "purchase",
    artistId,
    trackId: itemType === "track" ? itemId : null,
    userId: buyerType === "fan" ? null : buyerId,
    sessionId: sessionId || buyerId || "anon",
    watchMs: 0,
    v: 1,
    meta: { itemType, itemId, qty, amount, currency, platformFee, artistNet, buyerType, buyerId },
  };

  const evWrite = appendJsonl(EVENTS_LOG, event);

  const achFan = bestEffortWriteAchievement({
    subjectType: "fan",
    subjectId: buyerId,
    message: `🛒 Supporter purchase! You supported ${artist?.name || artistId} (${itemType}).`,
    stats: { amount, currency, itemType, qty },
    meta: { artistId, itemId, purchaseId: id },
  });

  const achArtist = bestEffortWriteAchievement({
    subjectType: "artist",
    subjectId: artistId,
    message: `💚 New supporter purchase received (${itemType}).`,
    stats: { amount, currency, itemType, qty },
    meta: { buyerId, itemId, purchaseId: id },
  });

  return res.json({
    success: true,
    updatedAt: storeLoad.store.updatedAt || at,
    recorded: true,
    deduped: false,
    purchase,
    artist,
    emittedEvent: { ok: evWrite.ok, error: evWrite.error },
    achievements: { fan: achFan, artist: achArtist, file: ACHIEVEMENTS_FILE },
  });
});

// -------------------------
// POST /subscribe
// Records a subscription (fan -> iBand unlimited OR fan -> specific artist tier later)
// -------------------------
router.post("/subscribe", express.json({ limit: "200kb" }), (req, res) => {
  const body = req.body || {};

  const subscriberId = normalizeStr(body.subscriberId || body.sessionId || "anon");
  const plan = normalizeStr(body.plan || "iband_unlimited");
  const targetArtistId = normalizeStr(body.artistId || "");
  const currency = normalizeStr(body.currency || "GBP").toUpperCase();
  const amount = asMoney(body.amount || 0);

  const periodDays = clamp(asInt(body.periodDays, DEFAULTS.defaultSubPeriodDays), 1, DEFAULTS.maxSubPeriodDays);
  const at = nowIso();
  const startsAt = body.startsAt ? new Date(body.startsAt).toISOString() : at;
  const endsAt = new Date(Date.parse(startsAt) + periodDays * 24 * 60 * 60 * 1000).toISOString();

  const sessionId = normalizeStr(body.sessionId || "");
  const meta = body.meta && typeof body.meta === "object" ? body.meta : null;

  if (!isNonEmpty(subscriberId)) return res.status(400).json({ success: false, message: "Invalid subscription payload. subscriberId/sessionId required.", updatedAt: nowIso() });
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: "Invalid subscription payload. amount must be > 0.", updatedAt: nowIso() });

  const storeLoad = ensureStore();
  if (!storeLoad.ok) return res.status(500).json({ success: false, message: "Purchases store not available.", error: storeLoad.error, updatedAt: nowIso() });

  const nowMs = Date.now();
  const active = (storeLoad.store.subs || []).find((s) => {
    if (!s) return false;
    if (s.subscriberId !== subscriberId) return false;
    if (s.plan !== plan) return false;
    if ((s.artistId || "") !== (targetArtistId || "")) return false;
    const e = Date.parse(s.endsAt);
    return Number.isFinite(e) && e > nowMs && s.status === "active";
  });

  if (active) {
    const prevEnd = Date.parse(active.endsAt);
    const newEnd = new Date(prevEnd + periodDays * 24 * 60 * 60 * 1000).toISOString();
    active.endsAt = newEnd;
    active.updatedAt = at;
    active.amountTotal = asMoney((Number(active.amountTotal || 0) || 0) + amount);

    persistStore(storeLoad.store);

    appendJsonl(EVENTS_LOG, {
      id: makeId("evt"),
      at,
      type: "subscribe",
      artistId: targetArtistId || null,
      trackId: null,
      userId: null,
      sessionId: sessionId || subscriberId,
      watchMs: 0,
      v: 1,
      meta: { plan, amount, currency, extended: true, endsAt: newEnd, subscriberId },
    });

    bestEffortWriteAchievement({
      subjectType: "fan",
      subjectId: subscriberId,
      message: `⭐ Subscription extended: ${plan}`,
      stats: { amount, currency, periodDays },
      meta: { plan, endsAt: newEnd },
    });

    return res.json({ success: true, updatedAt: storeLoad.store.updatedAt || at, recorded: true, mode: "extended", subscription: active });
  }

  const sub = {
    id: makeId("sub"),
    at,
    updatedAt: at,
    type: "subscription",
    status: "active",

    subscriberId,
    sessionId: sessionId || null,

    plan,
    artistId: targetArtistId || null,

    currency,
    amountInitial: amount,
    amountTotal: amount,

    startsAt,
    endsAt,
    periodDays,

    provider: body.provider ? normalizeStr(body.provider) : "ledger",
    providerRef: body.providerRef ? normalizeStr(body.providerRef) : null,

    meta,
    v: 1,
  };

  storeLoad.store.subs.push(sub);
  persistStore(storeLoad.store);

  appendJsonl(EVENTS_LOG, {
    id: makeId("evt"),
    at,
    type: "subscribe",
    artistId: targetArtistId || null,
    trackId: null,
    userId: null,
    sessionId: sessionId || subscriberId,
    watchMs: 0,
    v: 1,
    meta: { plan, amount, currency, startsAt, endsAt, subscriberId },
  });

  bestEffortWriteAchievement({
    subjectType: "fan",
    subjectId: subscriberId,
    message: `⭐ Subscription started: ${plan}`,
    stats: { amount, currency, periodDays },
    meta: { plan, startsAt, endsAt },
  });

  return res.json({ success: true, updatedAt: storeLoad.store.updatedAt || at, recorded: true, subscription: sub });
});

// -------------------------
// GET /ownership
// Query: buyerId/sessionId, artistId, itemType, itemId
// -------------------------
router.get("/ownership", (req, res) => {
  const buyerId = normalizeStr(req.query.buyerId || req.query.sessionId || "anon");
  const artistId = normalizeStr(req.query.artistId || "");
  const itemType = normalizeStr(req.query.itemType || "track");
  const itemId = normalizeStr(req.query.itemId || "");

  if (!isNonEmpty(buyerId) || !isNonEmpty(artistId) || !isNonEmpty(itemId)) {
    return res.status(400).json({ success: false, message: "Requires buyerId/sessionId, artistId, itemId.", updatedAt: nowIso() });
  }

  const storeLoad = ensureStore();
  if (!storeLoad.ok) return res.status(500).json({ success: false, message: "Purchases store not available.", error: storeLoad.error, updatedAt: nowIso() });

  const matches = (storeLoad.store.purchases || []).filter((p) => {
    if (!p) return false;
    if (p.buyerId !== buyerId) return false;
    if (p.artistId !== artistId) return false;
    if (p.itemType !== itemType) return false;
    if (p.itemId !== itemId) return false;
    return p.status === "captured";
  });

  const qty = matches.reduce((sum, p) => sum + (Number(p.qty || 0) || 0), 0);

  return res.json({
    success: true,
    updatedAt: storeLoad.store.updatedAt || nowIso(),
    buyerId,
    artistId,
    itemType,
    itemId,
    owned: qty > 0,
    qty,
    lastPurchaseAt: matches.length ? matches[matches.length - 1].at : null,
  });
});

// -------------------------
// GET /intelligence
// UI decision helper for one video
// Query: buyerId, artistId, trackId, albumId, plan
// -------------------------
router.get("/intelligence", (req, res) => {
  const buyerId = normalizeStr(req.query.buyerId || req.query.sessionId || "anon");
  const artistId = normalizeStr(req.query.artistId || "");
  const trackId = normalizeStr(req.query.trackId || "");
  const albumId = normalizeStr(req.query.albumId || "");
  const plan = normalizeStr(req.query.plan || "iband_unlimited");

  if (!isNonEmpty(buyerId) || !isNonEmpty(artistId) || !isNonEmpty(trackId)) {
    return res.status(400).json({
      success: false,
      message: "Requires buyerId/sessionId, artistId, trackId.",
      updatedAt: nowIso(),
    });
  }

  const storeLoad = ensureStore();
  if (!storeLoad.ok) return res.status(500).json({ success: false, message: "Purchases store not available.", error: storeLoad.error, updatedAt: nowIso() });

  const artists = loadArtistsIndex();
  const artist = artists.artistsById?.[artistId] || { id: artistId, name: null, genre: null, location: null, imageUrl: null };

  // Ownership
  const purchases = storeLoad.store.purchases || [];
  const ownsTrackMatches = purchases.filter((p) => p && p.status === "captured" && p.buyerId === buyerId && p.artistId === artistId && p.itemType === "track" && p.itemId === trackId);
  const ownsTrackQty = ownsTrackMatches.reduce((sum, p) => sum + (Number(p.qty || 0) || 0), 0);

  const ownsAlbumMatches =
    albumId
      ? purchases.filter((p) => p && p.status === "captured" && p.buyerId === buyerId && p.artistId === artistId && p.itemType === "album" && p.itemId === albumId)
      : [];
  const ownsAlbumQty = ownsAlbumMatches.reduce((sum, p) => sum + (Number(p.qty || 0) || 0), 0);

  // Subscription
  const subs = storeLoad.store.subs || [];
  const hasSubscription = subs.some((s) => s && s.subscriberId === buyerId && s.plan === plan && isActiveSub(s));

  // Supporter
  const spend = purchases
    .filter((p) => p && p.status === "captured" && p.buyerId === buyerId)
    .reduce((sum, p) => sum + (Number(p.amount || 0) || 0), 0);

  const count = purchases.filter((p) => p && p.status === "captured" && p.buyerId === buyerId).length;
  const supporter = { level: computeSupporterLevel(asMoney(spend), count), spend: asMoney(spend), count };

  // UI logic (simple + deterministic)
  const ui = {
    trackButton: ownsTrackQty > 0 ? "added" : "buy",
    albumButton: albumId ? (ownsAlbumQty > 0 ? "added" : "buy") : "hidden",
    streaming: !!hasSubscription,
    recommendedAction: hasSubscription ? "stream" : ownsTrackQty > 0 ? "play_track" : "buy_track",
  };

  return res.json({
    success: true,
    updatedAt: storeLoad.store.updatedAt || nowIso(),
    buyerId,
    artistId,
    trackId,
    albumId: albumId || null,
    plan,
    ownsTrack: { owned: ownsTrackQty > 0, qty: ownsTrackQty, lastPurchaseAt: ownsTrackMatches.length ? ownsTrackMatches[ownsTrackMatches.length - 1].at : null },
    ownsAlbum: { owned: ownsAlbumQty > 0, qty: ownsAlbumQty, lastPurchaseAt: ownsAlbumMatches.length ? ownsAlbumMatches[ownsAlbumMatches.length - 1].at : null },
    hasSubscription,
    supporter,
    ui,
    artist,
    cached: !!storeLoad.cached,
    cacheAgeMs: Date.now() - cache.atMs,
  });
});

// -------------------------
// GET /signals/artist/:artistId
// Monetisation Signals for an artist (revenue/supporters/subs)
// Query: windowDays (default 30)
// -------------------------
router.get("/signals/artist/:artistId", (req, res) => {
  const artistId = normalizeStr(req.params.artistId || "");
  if (!isNonEmpty(artistId)) return res.status(400).json({ success: false, message: "artistId required.", updatedAt: nowIso() });

  const storeLoad = ensureStore();
  if (!storeLoad.ok) return res.status(500).json({ success: false, message: "Purchases store not available.", error: storeLoad.error, updatedAt: nowIso() });

  const artists = loadArtistsIndex();
  const artistMeta = artists.artistsById?.[artistId] || { id: artistId, name: null, genre: null, location: null, imageUrl: null };

  const s = calcSignals(storeLoad.store, { windowDays: req.query.windowDays });

  const a = s.artist[artistId] || {
    revenueGross: 0,
    revenueNet: 0,
    platformFees: 0,
    purchases: 0,
    qty: 0,
    uniqueBuyersCount: 0,
    lastAt: null,
  };

  const activeSubs = (s.activeSubsByArtist[artistId] || []).length;

  // A simple “monetisationScore” for algorithm wiring (tunable later)
  const monetisationScore =
    a.revenueGross * 2 +
    a.uniqueBuyersCount * 1.5 +
    a.purchases * 0.5 +
    activeSubs * 3;

  return res.json({
    success: true,
    updatedAt: storeLoad.store.updatedAt || nowIso(),
    windowDays: s.windowDays,
    sinceAt: s.sinceAt,
    artistId,
    artist: artistMeta,
    signals: {
      revenueGross: asMoney(a.revenueGross),
      revenueNet: asMoney(a.revenueNet),
      platformFees: asMoney(a.platformFees),
      purchases: a.purchases,
      qty: a.qty,
      uniqueBuyers: a.uniqueBuyersCount,
      activeSubs,
      lastAt: a.lastAt,
      monetisationScore: asMoney(monetisationScore),
    },
    cached: !!storeLoad.cached,
    cacheAgeMs: Date.now() - cache.atMs,
  });
});

// -------------------------
// GET /signals/fan/:buyerId
// Monetisation Signals for a fan (spend/purchases/subscription)
// Query: windowDays (default 30)
// -------------------------
router.get("/signals/fan/:buyerId", (req, res) => {
  const buyerId = normalizeStr(req.params.buyerId || "");
  if (!isNonEmpty(buyerId)) return res.status(400).json({ success: false, message: "buyerId required.", updatedAt: nowIso() });

  const storeLoad = ensureStore();
  if (!storeLoad.ok) return res.status(500).json({ success: false, message: "Purchases store not available.", error: storeLoad.error, updatedAt: nowIso() });

  const s = calcSignals(storeLoad.store, { windowDays: req.query.windowDays });

  const f = s.fan[buyerId] || { spend: 0, purchases: 0, uniqueArtistsCount: 0, lastAt: null };
  const activeSubs = (s.activeSubsByFan[buyerId] || []).filter((x) => isActiveSub(x)).length;

  const level = computeSupporterLevel(asMoney(f.spend), f.purchases);

  // Fan “valueScore” (for future perks/badges + algorithm signals)
  const valueScore =
    f.spend * 2 +
    f.purchases * 1 +
    f.uniqueArtistsCount * 1.25 +
    activeSubs * 5;

  return res.json({
    success: true,
    updatedAt: storeLoad.store.updatedAt || nowIso(),
    windowDays: s.windowDays,
    sinceAt: s.sinceAt,
    buyerId,
    signals: {
      spend: asMoney(f.spend),
      purchases: f.purchases,
      uniqueArtists: f.uniqueArtistsCount,
      activeSubs,
      lastAt: f.lastAt,
      supporterLevel: level,
      valueScore: asMoney(valueScore),
    },
    cached: !!storeLoad.cached,
    cacheAgeMs: Date.now() - cache.atMs,
  });
});

// -------------------------
// GET /signals/top-artists
// Lists top artists by revenueGross within window
// Query: windowDays, limit
// -------------------------
router.get("/signals/top-artists", (req, res) => {
  const storeLoad = ensureStore();
  if (!storeLoad.ok) return res.status(500).json({ success: false, message: "Purchases store not available.", error: storeLoad.error, updatedAt: nowIso() });

  const limit = clamp(asInt(req.query.limit, 10), 1, DEFAULTS.maxReturn);

  const artists = loadArtistsIndex();
  const s = calcSignals(storeLoad.store, { windowDays: req.query.windowDays });

  const rows = Object.keys(s.artist).map((artistId) => {
    const a = s.artist[artistId];
    const meta = artists.artistsById?.[artistId] || { id: artistId, name: null, genre: null, location: null, imageUrl: null };
    const activeSubs = (s.activeSubsByArtist[artistId] || []).length;

    const monetisationScore =
      a.revenueGross * 2 +
      a.uniqueBuyersCount * 1.5 +
      a.purchases * 0.5 +
      activeSubs * 3;

    return {
      artistId,
      artist: meta,
      revenueGross: asMoney(a.revenueGross),
      revenueNet: asMoney(a.revenueNet),
      uniqueBuyers: a.uniqueBuyersCount,
      purchases: a.purchases,
      activeSubs,
      lastAt: a.lastAt,
      monetisationScore: asMoney(monetisationScore),
    };
  });

  rows.sort((a, b) => (b.revenueGross - a.revenueGross) || (b.uniqueBuyers - a.uniqueBuyers) || (b.purchases - a.purchases));

  return res.json({
    success: true,
    updatedAt: storeLoad.store.updatedAt || nowIso(),
    windowDays: s.windowDays,
    sinceAt: s.sinceAt,
    count: Math.min(limit, rows.length),
    results: rows.slice(0, limit),
    cached: !!storeLoad.cached,
    cacheAgeMs: Date.now() - cache.atMs,
  });
});

// -------------------------
// GET /list
// Lists purchases or subscriptions with filters
// Query: kind=purchases|subs, buyerId, subscriberId, artistId, limit, order=asc|desc
// -------------------------
router.get("/list", (req, res) => {
  const kind = normalizeStr(req.query.kind || "purchases");
  const limit = clamp(asInt(req.query.limit, DEFAULTS.maxReturn), 1, DEFAULTS.maxReturn);
  const order = normalizeStr(req.query.order || "desc");

  const buyerId = normalizeStr(req.query.buyerId || "");
  const subscriberId = normalizeStr(req.query.subscriberId || "");
  const artistId = normalizeStr(req.query.artistId || "");

  const storeLoad = ensureStore();
  if (!storeLoad.ok) return res.status(500).json({ success: false, message: "Purchases store not available.", error: storeLoad.error, updatedAt: nowIso() });

  let arr = kind === "subs" ? (storeLoad.store.subs || []) : (storeLoad.store.purchases || []);
  arr = arr.filter((x) => !!x);

  if (kind === "purchases" && buyerId) arr = arr.filter((p) => p.buyerId === buyerId);
  if (kind === "subs" && subscriberId) arr = arr.filter((s) => s.subscriberId === subscriberId);
  if (artistId) arr = arr.filter((x) => (x.artistId || "") === artistId);

  arr.sort((a, b) => {
    const ta = Date.parse(a.at || a.updatedAt || 0) || 0;
    const tb = Date.parse(b.at || b.updatedAt || 0) || 0;
    return order === "asc" ? ta - tb : tb - ta;
  });

  return res.json({
    success: true,
    updatedAt: storeLoad.store.updatedAt || nowIso(),
    filters: { kind, buyerId: buyerId || null, subscriberId: subscriberId || null, artistId: artistId || null, order },
    count: Math.min(limit, arr.length),
    results: arr.slice(0, limit),
    cached: !!storeLoad.cached,
    cacheAgeMs: Date.now() - cache.atMs,
  });
});

export default router;