// countries.js (ESM) — Phase H7.3 Country Discovery + Signals + Artist Charts Engine

import express from "express";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";

const router = express.Router();

const SERVICE = "countries";
const PHASE = "H7.3";
const VERSION = 3;

const DB_ROOT = process.env.IBAND_DATA_DIR || "/var/data/iband/db";
const STORAGE_DIR = path.join(DB_ROOT, "countries");
const STORE_FILE = path.join(STORAGE_DIR, "countries.json");
const EVENTS_FILE = path.join(STORAGE_DIR, "country-events.jsonl");

const ARTISTS_FILE_CANDIDATES = [
  path.join(DB_ROOT, "artists", "artists.json"),
  path.join(DB_ROOT, "artists.json"),
];

const LIMITS = {
  maxBodyBytes: 25000,
  maxList: 100,
  maxReadBytes: 20 * 1024 * 1024,
  maxLineScan: 200000,
};

const TUNING = {
  weights: {
    share: 6,
    vote: 2,
    purchase: 10,
    upload: 4,
    artist_create: 3,
    other: 1,
  },
  halfLifeDaysArtists: 21,
  maxLookbackDays: 120,
};

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  return crypto.randomBytes(12).toString("hex");
}

function safeStr(v, max = 200) {
  const s = (v ?? "").toString().trim();
  return s.length > max ? s.slice(0, max) : s;
}

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function daysBetween(nowMs, thenMs) {
  return (nowMs - thenMs) / (1000 * 60 * 60 * 24);
}

function decayWeight(ageDays, halfLifeDays) {
  return Math.pow(0.5, ageDays / Math.max(0.0001, halfLifeDays));
}

async function ensureStore() {
  await fsp.mkdir(STORAGE_DIR, { recursive: true });

  if (!fs.existsSync(STORE_FILE)) {
    await fsp.writeFile(
      STORE_FILE,
      JSON.stringify({ version: 1, countries: [], updatedAt: nowIso() }, null, 2)
    );
  }
}

async function readStore() {
  await ensureStore();
  const raw = await fsp.readFile(STORE_FILE, "utf8");
  const parsed = JSON.parse(raw || "{}");
  return {
    version: parsed.version || 1,
    updatedAt: parsed.updatedAt || nowIso(),
    countries: Array.isArray(parsed.countries) ? parsed.countries : [],
  };
}

async function writeStore(store) {
  store.updatedAt = nowIso();
  await fsp.writeFile(STORE_FILE, JSON.stringify(store, null, 2));
}

async function appendEvent(ev) {
  await ensureStore();
  await fsp.appendFile(EVENTS_FILE, JSON.stringify(ev) + "\n");
}

async function readArtistsStore() {
  for (const filePath of ARTISTS_FILE_CANDIDATES) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const raw = await fsp.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw || "{}");

      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed.artists)) return parsed.artists;
      if (Array.isArray(parsed.list)) return parsed.list;
    } catch {
      // continue
    }
  }
  return [];
}

function normalizeArtistRow(row) {
  return {
    id: safeStr(row.id || row.artistId, 80),
    name: safeStr(row.name, 120) || "Unknown Artist",
    genre: safeStr(row.genre, 120) || null,
    location: safeStr(row.location, 120) || null,
    imageUrl: safeStr(row.imageUrl, 500) || null,
    votes: Number(row.votes) || 0,
    updatedAt: row.updatedAt || null,
  };
}

function ok(res, payload) {
  res.status(200).json(payload);
}

function bad(res, status, error, extra = {}) {
  res.status(status).json({ success: false, error, ...extra });
}

async function scanCountryArtistScores({ countryId, days }) {
  const lookbackDays = clampInt(days, 1, TUNING.maxLookbackDays, 30);

  if (!fs.existsSync(EVENTS_FILE)) {
    return { scores: new Map(), uses: new Map(), scannedLines: 0 };
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
  const uses = new Map();

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

    if (safeStr(ev.countryId, 80) !== countryId) continue;

    const artistId = safeStr(ev.artistId, 80);
    if (!artistId) continue;

    const type = safeStr(ev.type, 40).toLowerCase() || "other";
    const base = TUNING.weights[type] || TUNING.weights.other;

    const ageDays = daysBetween(nowMs, ts);
    const w = decayWeight(ageDays, TUNING.halfLifeDaysArtists) * base;

    scores.set(artistId, (scores.get(artistId) || 0) + w);
    uses.set(artistId, (uses.get(artistId) || 0) + 1);
  }

  return { scores, uses, scannedLines: scanned };
}

/* ---------- HEALTH ---------- */

router.get("/health", async (req, res) => {
  await ensureStore();
  const stat = fs.statSync(STORE_FILE);
  const store = await readStore();

  ok(res, {
    success: true,
    service: SERVICE,
    phase: PHASE,
    version: VERSION,
    storageDir: STORAGE_DIR,
    file: {
      path: STORE_FILE,
      ok: true,
      size: stat.size
    },
    store: {
      countries: store.countries.length
    },
    ts: nowIso()
  });
});

/* ---------- CREATE COUNTRY ---------- */

router.post("/create", async (req, res) => {
  const body = req.body || {};
  const name = safeStr(body.name, 80);

  if (!name) {
    return bad(res, 400, "missing_country_name");
  }

  const store = await readStore();

  const exists = store.countries.find(
    c => c.name.toLowerCase() === name.toLowerCase()
  );

  if (exists) {
    return bad(res, 409, "country_exists", { country: exists });
  }

  const country = {
    id: "country_" + makeId(),
    name,
    code: safeStr(body.code, 8).toUpperCase() || null,
    region: safeStr(body.region, 80) || "Unknown",
    subregion: safeStr(body.subregion, 80) || null,
    flag: safeStr(body.flag, 10) || null,
    localGenres: Array.isArray(body.localGenres) ? body.localGenres : [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    counters: {
      shares: 0,
      votes: 0,
      purchases: 0,
      uploads: 0,
      artists: 0
    }
  };

  store.countries.unshift(country);
  await writeStore(store);

  ok(res, {
    success: true,
    message: "Country created.",
    country
  });
});

/* ---------- LIST COUNTRIES ---------- */

router.get("/list", async (req, res) => {
  const store = await readStore();

  ok(res, {
    success: true,
    countries: store.countries,
    meta: {
      total: store.countries.length,
      limit: LIMITS.maxList,
      ts: nowIso()
    }
  });
});

/* ---------- COUNTRY SIGNAL ---------- */

router.post("/signal", async (req, res) => {
  const body = req.body || {};
  const countryId = safeStr(body.countryId, 80);
  const type = safeStr(body.type, 40);
  const artistId = safeStr(body.artistId, 80) || null;
  const genreId = safeStr(body.genreId, 80) || null;

  if (!countryId) {
    return bad(res, 400, "missing_countryId");
  }

  const store = await readStore();
  const country = store.countries.find(c => c.id === countryId);

  if (!country) {
    return bad(res, 404, "country_not_found");
  }

  const counters = country.counters || {
    shares: 0,
    votes: 0,
    purchases: 0,
    uploads: 0,
    artists: 0
  };

  if (type === "share") counters.shares += 1;
  if (type === "vote") counters.votes += 1;
  if (type === "purchase") counters.purchases += 1;
  if (type === "upload") counters.uploads += 1;
  if (type === "artist_create") counters.artists += 1;

  country.counters = counters;
  country.updatedAt = nowIso();

  await writeStore(store);

  await appendEvent({
    id: makeId(),
    type,
    countryId,
    artistId,
    genreId,
    ts: nowIso()
  });

  ok(res, {
    success: true,
    message: "Country signal recorded.",
    countryId,
    type,
    artistId,
    genreId
  });
});

/* ---------- TOP ARTISTS BY COUNTRY ---------- */

router.get("/:countryId/artists", async (req, res) => {
  const countryId = safeStr(req.params.countryId, 80);
  const days = clampInt(req.query.days, 1, TUNING.maxLookbackDays, 30);
  const limit = clampInt(req.query.limit, 1, LIMITS.maxList, 10);

  const store = await readStore();
  const country = store.countries.find(c => c.id === countryId);

  if (!country) {
    return bad(res, 404, "country_not_found", { countryId });
  }

  const artistsRaw = await readArtistsStore();
  const artists = artistsRaw.map(normalizeArtistRow).filter(a => a.id);

  const { scores, uses, scannedLines } = await scanCountryArtistScores({ countryId, days });

  const ranked = artists
    .map((artist) => {
      const countryScore = scores.get(artist.id) || 0;
      const countryUses = uses.get(artist.id) || 0;
      const voteBoost = (Number(artist.votes) || 0) * 0.05;
      const compositeScore = countryScore + voteBoost;

      return {
        id: artist.id,
        name: artist.name,
        genre: artist.genre,
        location: artist.location,
        imageUrl: artist.imageUrl,
        votes: artist.votes,
        countryUses,
        countryScore,
        compositeScore,
        updatedAt: artist.updatedAt,
      };
    })
    .filter((x) => x.countryScore > 0 || x.countryUses > 0)
    .sort((a, b) => b.compositeScore - a.compositeScore);

  ok(res, {
    success: true,
    country: {
      id: country.id,
      name: country.name,
      code: country.code,
      flag: country.flag,
      region: country.region,
      subregion: country.subregion,
    },
    days,
    list: ranked.slice(0, limit),
    meta: {
      limit,
      scannedLines,
      artistsLoaded: artists.length,
      ts: nowIso(),
    },
  });
});

/* ---------- SINGLE COUNTRY ---------- */

router.get("/:countryId", async (req, res) => {
  const countryId = safeStr(req.params.countryId, 80);
  const store = await readStore();

  const country = store.countries.find((c) => c.id === countryId);
  if (!country) {
    return bad(res, 404, "country_not_found", { countryId });
  }

  ok(res, {
    success: true,
    country,
    ts: nowIso(),
  });
});

export default router;