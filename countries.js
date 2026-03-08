// countries.js (ESM) — Phase H7.1 Country / Region Discovery Engine
// Purpose:
// - Country registry for music discovery
// - Region grouping (e.g. Balkans, Latin America, MENA, West Africa)
// - Link countries to core local genres
// - Foundation for country charts and regional signals later
//
// Storage:
// - /var/data/iband/db/countries/countries.json
//
// Future phases will add:
// - country signals
// - top artists by country
// - top genres by country
// - region charts

import express from "express";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";

const router = express.Router();

const SERVICE = "countries";
const PHASE = "H7.1";
const VERSION = 1;

const DB_ROOT = process.env.IBAND_DATA_DIR || "/var/data/iband/db";
const STORAGE_DIR = path.join(DB_ROOT, "countries");
const STORE_FILE = path.join(STORAGE_DIR, "countries.json");

const LIMITS = {
  maxBodyBytes: 25000,
  maxNameLen: 80,
  maxCodeLen: 8,
  maxRegionLen: 80,
  maxGenres: 30,
  maxList: 100,
};

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  return `country_${crypto.randomBytes(12).toString("hex")}`;
}

function safeStr(v, max = 300) {
  const s = (v ?? "").toString().trim();
  return s.length > max ? s.slice(0, max) : s;
}

function uniq(values) {
  const out = [];
  const seen = new Set();
  for (const raw of values || []) {
    const v = safeStr(raw, 60);
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

async function ensureStore() {
  await fsp.mkdir(STORAGE_DIR, { recursive: true });

  if (!fs.existsSync(STORE_FILE)) {
    await fsp.writeFile(
      STORE_FILE,
      JSON.stringify(
        {
          version: 1,
          updatedAt: nowIso(),
          countries: [],
        },
        null,
        2
      ),
      "utf8"
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
  await fsp.writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

function ok(res, payload) {
  res.status(200).json(payload);
}

function bad(res, status, error, extra = {}) {
  res.status(status).json({ success: false, error, ...extra });
}

// Health
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
      size: stat.size,
      mtimeMs: stat.mtimeMs,
    },
    store: {
      countries: store.countries.length,
      updatedAt: store.updatedAt,
    },
    limits: LIMITS,
    ts: nowIso(),
  });
});

// Create country
router.post("/create", async (req, res) => {
  const body = req.body || {};
  const bytes = Buffer.byteLength(JSON.stringify(body), "utf8");
  if (bytes > LIMITS.maxBodyBytes) {
    return bad(res, 413, "payload_too_large");
  }

  const name = safeStr(body.name, LIMITS.maxNameLen);
  if (!name) {
    return bad(res, 400, "missing_country_name");
  }

  const code = safeStr(body.code, LIMITS.maxCodeLen).toUpperCase() || null;
  const region = safeStr(body.region, LIMITS.maxRegionLen) || "Unknown";
  const subregion = safeStr(body.subregion, LIMITS.maxRegionLen) || null;
  const flag = safeStr(body.flag, 12) || null;
  const localGenres = uniq(body.localGenres || body.genres || []).slice(0, LIMITS.maxGenres);

  const store = await readStore();

  const existsByName = store.countries.find(
    (c) => safeStr(c.name, LIMITS.maxNameLen).toLowerCase() === name.toLowerCase()
  );
  if (existsByName) {
    return bad(res, 409, "country_exists", { country: existsByName });
  }

  const existsByCode =
    code &&
    store.countries.find(
      (c) => safeStr(c.code, LIMITS.maxCodeLen).toUpperCase() === code
    );

  if (existsByCode) {
    return bad(res, 409, "country_code_exists", { country: existsByCode });
  }

  const country = {
    id: makeId(),
    name,
    code,
    region,
    subregion,
    flag,
    localGenres,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    counters: {
      shares: 0,
      votes: 0,
      purchases: 0,
      uploads: 0,
      artists: 0,
    },
  };

  store.countries.unshift(country);
  await writeStore(store);

  ok(res, {
    success: true,
    message: "Country created.",
    country,
  });
});

// List countries
router.get("/list", async (req, res) => {
  const store = await readStore();

  const limit = Math.max(1, Math.min(LIMITS.maxList, Number(req.query.limit) || 50));
  const region = safeStr(req.query.region, LIMITS.maxRegionLen).toLowerCase();
  const q = safeStr(req.query.q, 60).toLowerCase();

  let list = store.countries.slice();

  if (region) {
    list = list.filter((c) => safeStr(c.region, LIMITS.maxRegionLen).toLowerCase() === region);
  }

  if (q) {
    list = list.filter((c) => {
      const hay = `${c.name || ""} ${c.code || ""} ${c.region || ""} ${c.subregion || ""} ${(c.localGenres || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }

  ok(res, {
    success: true,
    countries: list.slice(0, limit),
    meta: {
      total: list.length,
      limit,
      ts: nowIso(),
    },
  });
});

// Get single country
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