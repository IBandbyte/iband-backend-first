// genres.js (ESM) — Phase H6.1 Genre Discovery Engine (Registry + Signals)
// Purpose:
// - Genre registry (official + community-created)
// - Fan suggestions for new genres (queue-like)
// - Usage signals for trending/emerging detection
// Storage:
// - /var/data/iband/db/genres/genres.json
// - /var/data/iband/db/genres/events/genre-events.jsonl
//
// Signals (recorded as JSONL events):
// - genre_create
// - genre_suggest
// - genre_use (share/vote/purchase/upload tag usage)
//
// IMPORTANT: Route order matters in Express.
// /trending and /emerging MUST be defined before /:genreId

import express from "express";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";

const router = express.Router();

const SERVICE = "genres";
const PHASE = "H6.1";
const VERSION = 1;

const DB_ROOT = process.env.IBAND_DATA_DIR || "/var/data/iband/db";
const STORAGE_DIR = path.join(DB_ROOT, "genres");
const GENRES_FILE = path.join(STORAGE_DIR, "genres.json");
const EVENTS_DIR = path.join(STORAGE_DIR, "events");
const EVENTS_FILE = path.join(EVENTS_DIR, "genre-events.jsonl");

// Read fan profiles directly to avoid internal router coupling
const FANS_DIR = path.join(DB_ROOT, "fans");
const FAN_PROFILES_FILE = path.join(FANS_DIR, "fan-profiles.json");

const LIMITS = {
  maxBodyBytes: 25000,
  maxReadBytes: 20 * 1024 * 1024,
  maxLineScan: 200000,
  maxNameLen: 60,
  maxDescLen: 240,
  maxTags: 10,
  maxList: 50,
};

const TUNING = {
  // Score weights by event kind
  weights: {
    share: 6,
    vote: 2,
    purchase: 10,
    upload: 4,
    room_post: 1,
    other: 1,
  },
  // time decay
  halfLifeDaysTrending: 14,
  halfLifeDaysEmerging: 5,
  maxLookbackDays: 120,
  // emerging preference for recent birth
  emergingBirthBonusDays: 30,
};

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  return crypto.randomBytes(12).toString("hex");
}

function safeStr(v, max = 300) {
  const s = (v ?? "").toString().trim();
  return s.length > max ? s.slice(0, max) : s;
}

function toSlug(name) {
  return safeStr(name, 80)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function uniq(values) {
  const out = [];
  const seen = new Set();
  for (const raw of values || []) {
    const v = safeStr(raw, 40);
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

async function ensureDirs() {
  await fsp.mkdir(STORAGE_DIR, { recursive: true });
  await fsp.mkdir(EVENTS_DIR, { recursive: true });

  if (!fs.existsSync(GENRES_FILE)) {
    await fsp.writeFile(
      GENRES_FILE,
      JSON.stringify(
        {
          version: 1,
          updatedAt: nowIso(),
          genres: [],
          suggestions: [],
        },
        null,
        2
      )
    );
  }
}

async function readStore() {
  await ensureDirs();
  const raw = await fsp.readFile(GENRES_FILE, "utf8");
  const store = JSON.parse(raw || "{}");
  return {
    version: store.version || 1,
    updatedAt: store.updatedAt || nowIso(),
    genres: Array.isArray(store.genres) ? store.genres : [],
    suggestions: Array.isArray(store.suggestions) ? store.suggestions : [],
  };
}

async function writeStore(store) {
  store.updatedAt = nowIso();
  await fsp.writeFile(GENRES_FILE, JSON.stringify(store, null, 2), "utf8");
}

async function appendEvent(obj) {
  await ensureDirs();
  await fsp.appendFile(EVENTS_FILE, JSON.stringify(obj) + "\n", "utf8");
}

function ok(res, payload) {
  res.status(200).json(payload);
}

function bad(res, status, error, extra = {}) {
  res.status(status).json({ success: false, error, ...extra });
}

async function getFanTier(fanId) {
  try {
    if (!fanId) return { tier: "none", verified: false };

    if (!fs.existsSync(FAN_PROFILES_FILE)) return { tier: "none", verified: false };
    const raw = await fsp.readFile(FAN_PROFILES_FILE, "utf8");
    const parsed = JSON.parse(raw || "{}");
    const profiles = Array.isArray(parsed.profiles) ? parsed.profiles : [];
    const p = profiles.find((x) => x.fanId === fanId);
    if (!p) return { tier: "none", verified: false };
    return {
      tier: safeStr(p.ambassadorTier, 20).toLowerCase() || "none",
      verified: Boolean(p.verifiedCreatorFan),
    };
  } catch {
    return { tier: "none", verified: false };
  }
}

function canCreateGenre({ tier, verified }) {
  return tier === "gold" || tier === "silver" || verified === true;
}

function daysBetween(nowMs, thenMs) {
  return (nowMs - thenMs) / (1000 * 60 * 60 * 24);
}

function decayWeight(ageDays, halfLifeDays) {
  // weight = 0.5^(age/halfLife)
  return Math.pow(0.5, ageDays / Math.max(0.0001, halfLifeDays));
}

async function scanEventsForScores({ days, mode }) {
  // mode: "trending" | "emerging"
  const lookbackDays = clampInt(days, 1, TUNING.maxLookbackDays, 30);
  const halfLife = mode === "emerging" ? TUNING.halfLifeDaysEmerging : TUNING.halfLifeDaysTrending;

  if (!fs.existsSync(EVENTS_FILE)) {
    return { scores: new Map(), counts: new Map(), scannedLines: 0 };
  }

  const stat = fs.statSync(EVENTS_FILE);
  const size = stat.size;
  const readBytes = Math.min(size, LIMITS.maxReadBytes);

  const fd = await fsp.open(EVENTS_FILE, "r");
  const buf = Buffer.alloc(readBytes);
  await fd.read(buf, 0, readBytes, Math.max(0, size - readBytes));
  await fd.close();

  const text = buf.toString("utf8");
  const lines = text.split("\n").filter(Boolean);

  const nowMs = Date.now();
  const cutoffMs = nowMs - lookbackDays * 24 * 60 * 60 * 1000;

  const scores = new Map();
  const counts = new Map();

  let scanned = 0;

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    scanned += 1;
    if (scanned > LIMITS.maxLineScan) break;

    let ev;
    try {
      ev = JSON.parse(lines[i]);
    } catch {
      continue;
    }

    const ts = Date.parse(ev.ts || "");
    if (!Number.isFinite(ts)) continue;
    if (ts < cutoffMs) break;

    if (ev.type !== "genre_use") continue;

    const genreId = safeStr(ev.genreId, 80);
    if (!genreId) continue;

    const ageDays = daysBetween(nowMs, ts);
    const base = Number(ev.weight) || 1;

    const w = decayWeight(ageDays, halfLife) * base;

    scores.set(genreId, (scores.get(genreId) || 0) + w);
    counts.set(genreId, (counts.get(genreId) || 0) + 1);
  }

  return { scores, counts, scannedLines: scanned };
}

// ---------- Routes ----------

// Health
router.get("/health", async (req, res) => {
  await ensureDirs();
  const store = await readStore();

  const genresOk = fs.existsSync(GENRES_FILE);
  const eventsOk = fs.existsSync(EVENTS_FILE);

  ok(res, {
    success: true,
    service: SERVICE,
    phase: PHASE,
    version: VERSION,
    storageDir: STORAGE_DIR,
    files: {
      genres: {
        path: GENRES_FILE,
        ok: genresOk,
        size: genresOk ? fs.statSync(GENRES_FILE).size : 0,
        mtimeMs: genresOk ? fs.statSync(GENRES_FILE).mtimeMs : null,
      },
      events: {
        path: EVENTS_FILE,
        ok: eventsOk,
        size: eventsOk ? fs.statSync(EVENTS_FILE).size : 0,
        mtimeMs: eventsOk ? fs.statSync(EVENTS_FILE).mtimeMs : null,
      },
    },
    store: {
      genres: store.genres.length,
      suggestions: store.suggestions.length,
      updatedAt: store.updatedAt,
    },
    limits: LIMITS,
    tuning: TUNING,
    ts: nowIso(),
  });
});

// Create genre (ambassador gold/silver OR verifiedCreatorFan)
router.post("/create", async (req, res) => {
  const body = req.body || {};
  const bytes = Buffer.byteLength(JSON.stringify(body), "utf8");
  if (bytes > LIMITS.maxBodyBytes) return bad(res, 413, "payload_too_large");

  const name = safeStr(body.name, LIMITS.maxNameLen);
  if (!name) return bad(res, 400, "missing_name");

  const fanId = safeStr(body.fanId, 80);
  if (!fanId) return bad(res, 400, "missing_fanId");

  const tierInfo = await getFanTier(fanId);
  if (!canCreateGenre(tierInfo)) {
    return bad(res, 403, "insufficient_permissions", {
      message: "Only verified or silver/gold ambassadors can create new genres.",
      tier: tierInfo.tier,
      verified: tierInfo.verified,
    });
  }

  const slug = toSlug(body.slug || name);
  if (!slug) return bad(res, 400, "invalid_slug");

  const description = safeStr(body.description, LIMITS.maxDescLen);
  const tags = uniq(body.tags || []).slice(0, LIMITS.maxTags);

  const store = await readStore();

  const exists = store.genres.find((g) => (g.slug || "").toLowerCase() === slug.toLowerCase());
  if (exists) return bad(res, 409, "genre_exists", { genre: exists });

  const genre = {
    id: `genre_${makeId()}`,
    name,
    slug,
    description,
    tags,
    status: "active", // active | archived
    createdByFanId: fanId,
    createdByTier: tierInfo.tier,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    counters: {
      uses: 0,
      shares: 0,
      votes: 0,
      purchases: 0,
      uploads: 0,
      roomPosts: 0,
    },
  };

  store.genres.unshift(genre);
  await writeStore(store);

  await appendEvent({
    id: makeId(),
    type: "genre_create",
    genreId: genre.id,
    slug: genre.slug,
    name: genre.name,
    fanId,
    ts: genre.createdAt,
    meta: body.meta || null,
  });

  ok(res, { success: true, message: "Genre created.", genre });
});

// Suggest genre (anyone)
router.post("/suggest", async (req, res) => {
  const body = req.body || {};
  const bytes = Buffer.byteLength(JSON.stringify(body), "utf8");
  if (bytes > LIMITS.maxBodyBytes) return bad(res, 413, "payload_too_large");

  const name = safeStr(body.name, LIMITS.maxNameLen);
  if (!name) return bad(res, 400, "missing_name");
  const fanId = safeStr(body.fanId, 80);
  if (!fanId) return bad(res, 400, "missing_fanId");

  const slug = toSlug(body.slug || name);
  if (!slug) return bad(res, 400, "invalid_slug");

  const description = safeStr(body.description, LIMITS.maxDescLen);
  const tags = uniq(body.tags || []).slice(0, LIMITS.maxTags);

  const store = await readStore();

  const existsGenre = store.genres.find((g) => (g.slug || "").toLowerCase() === slug.toLowerCase());
  if (existsGenre) return bad(res, 409, "genre_exists", { genre: existsGenre });

  const existsSuggestion = store.suggestions.find((s) => (s.slug || "").toLowerCase() === slug.toLowerCase());
  if (existsSuggestion) {
    existsSuggestion.endorsers = uniq([...(existsSuggestion.endorsers || []), fanId]).slice(0, 200);
    existsSuggestion.count = (existsSuggestion.count || 1) + 1;
    existsSuggestion.updatedAt = nowIso();
    await writeStore(store);

    await appendEvent({
      id: makeId(),
      type: "genre_suggest",
      action: "endorse",
      slug,
      name: existsSuggestion.name,
      fanId,
      ts: nowIso(),
      meta: body.meta || null,
    });

    return ok(res, {
      success: true,
      message: "Suggestion endorsed.",
      suggestion: existsSuggestion,
    });
  }

  const suggestion = {
    id: `suggest_${makeId()}`,
    name,
    slug,
    description,
    tags,
    status: "pending", // pending | approved | rejected
    count: 1,
    endorsers: [fanId],
    createdByFanId: fanId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  store.suggestions.unshift(suggestion);
  await writeStore(store);

  await appendEvent({
    id: makeId(),
    type: "genre_suggest",
    action: "create",
    slug,
    name,
    fanId,
    ts: suggestion.createdAt,
    meta: body.meta || null,
  });

  ok(res, { success: true, message: "Suggestion recorded.", suggestion });
});

// List genres (+ optional includeSuggestions)
router.get("/list", async (req, res) => {
  const store = await readStore();

  const limit = clampInt(req.query.limit, 1, LIMITS.maxList, 20);
  const q = safeStr(req.query.q, 60).toLowerCase();
  const includeSuggestions = String(req.query.includeSuggestions || "false").toLowerCase() === "true";

  let genres = store.genres.slice();
  if (q) {
    genres = genres.filter((g) => {
      const a = `${g.name || ""} ${g.slug || ""} ${(g.tags || []).join(" ")}`.toLowerCase();
      return a.includes(q);
    });
  }

  ok(res, {
    success: true,
    genres: genres.slice(0, limit),
    suggestions: includeSuggestions ? store.suggestions.slice(0, limit) : undefined,
    meta: {
      totalGenres: genres.length,
      totalSuggestions: store.suggestions.length,
      limit,
      ts: nowIso(),
    },
  });
});

// Record a genre usage signal (fan tagging a track/share/vote/purchase/upload)
router.post("/use", async (req, res) => {
  const body = req.body || {};
  const bytes = Buffer.byteLength(JSON.stringify(body), "utf8");
  if (bytes > LIMITS.maxBodyBytes) return bad(res, 413, "payload_too_large");

  const genreId = safeStr(body.genreId, 80);
  const fanId = safeStr(body.fanId, 80);
  const artistId = safeStr(body.artistId, 80) || null;
  const trackId = safeStr(body.trackId, 80) || null;

  const kind = safeStr(body.kind, 20).toLowerCase() || "other"; // share|vote|purchase|upload|room_post|other
  const weight = Number(body.weight) || TUNING.weights[kind] || TUNING.weights.other;

  if (!genreId) return bad(res, 400, "missing_genreId");
  if (!fanId) return bad(res, 400, "missing_fanId");

  const store = await readStore();
  const genre = store.genres.find((g) => g.id === genreId);
  if (!genre) return bad(res, 404, "genre_not_found", { genreId });

  genre.counters = genre.counters || {
    uses: 0,
    shares: 0,
    votes: 0,
    purchases: 0,
    uploads: 0,
    roomPosts: 0,
  };
  genre.counters.uses += 1;
  if (kind === "share") genre.counters.shares += 1;
  if (kind === "vote") genre.counters.votes += 1;
  if (kind === "purchase") genre.counters.purchases += 1;
  if (kind === "upload") genre.counters.uploads += 1;
  if (kind === "room_post") genre.counters.roomPosts += 1;

  genre.updatedAt = nowIso();
  await writeStore(store);

  const ev = {
    id: makeId(),
    type: "genre_use",
    genreId,
    genreSlug: genre.slug,
    kind,
    weight,
    fanId,
    artistId,
    trackId,
    ref: safeStr(body.ref, 80) || null,
    ts: nowIso(),
    meta: body.meta || null,
  };

  await appendEvent(ev);

  ok(res, {
    success: true,
    message: "Genre usage recorded.",
    event: {
      id: ev.id,
      type: ev.type,
      genreId: ev.genreId,
      kind: ev.kind,
      weight: ev.weight,
      ts: ev.ts,
    },
  });
});

// Trending genres  ✅ MUST COME BEFORE /:genreId
router.get("/trending", async (req, res) => {
  const days = clampInt(req.query.days, 1, TUNING.maxLookbackDays, 30);
  const limit = clampInt(req.query.limit, 1, LIMITS.maxList, 10);

  const store = await readStore();
  const { scores, counts, scannedLines } = await scanEventsForScores({ days, mode: "trending" });

  const ranked = store.genres
    .map((g) => {
      const score = scores.get(g.id) || 0;
      const c = counts.get(g.id) || 0;
      return {
        id: g.id,
        name: g.name,
        slug: g.slug,
        score,
        uses: c,
        counters: g.counters || {},
        updatedAt: g.updatedAt,
        createdAt: g.createdAt,
      };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  ok(res, {
    success: true,
    days,
    list: ranked.slice(0, limit),
    meta: {
      limit,
      scannedLines,
      ts: nowIso(),
    },
  });
});

// Emerging genres ✅ MUST COME BEFORE /:genreId
router.get("/emerging", async (req, res) => {
  const days = clampInt(req.query.days, 1, TUNING.maxLookbackDays, 14);
  const limit = clampInt(req.query.limit, 1, LIMITS.maxList, 10);

  const store = await readStore();
  const { scores, counts, scannedLines } = await scanEventsForScores({ days, mode: "emerging" });

  const nowMs = Date.now();

  const ranked = store.genres
    .map((g) => {
      const base = scores.get(g.id) || 0;
      const c = counts.get(g.id) || 0;

      const createdMs = Date.parse(g.createdAt || "") || 0;
      const ageDays = createdMs ? daysBetween(nowMs, createdMs) : 9999;

      const birthBonus =
        ageDays <= TUNING.emergingBirthBonusDays
          ? (TUNING.emergingBirthBonusDays - ageDays) / TUNING.emergingBirthBonusDays
          : 0;

      const score = base * (1 + birthBonus);

      return {
        id: g.id,
        name: g.name,
        slug: g.slug,
        score,
        uses: c,
        ageDays: Math.max(0, ageDays),
        counters: g.counters || {},
        updatedAt: g.updatedAt,
        createdAt: g.createdAt,
      };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  ok(res, {
    success: true,
    days,
    list: ranked.slice(0, limit),
    meta: {
      limit,
      scannedLines,
      ts: nowIso(),
    },
  });
});

// Get genre by id ✅ MUST COME AFTER /trending and /emerging
router.get("/:genreId", async (req, res) => {
  const genreId = safeStr(req.params.genreId, 80);
  const store = await readStore();
  const genre = store.genres.find((g) => g.id === genreId);
  if (!genre) return bad(res, 404, "genre_not_found", { genreId });
  ok(res, { success: true, genre, ts: nowIso() });
});

export default router;