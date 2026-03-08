
// countries.js (ESM) — Phase H7.2 Country Discovery + Signals Engine

import express from "express";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";

const router = express.Router();

const SERVICE = "countries";
const PHASE = "H7.2";
const VERSION = 2;

const DB_ROOT = process.env.IBAND_DATA_DIR || "/var/data/iband/db";
const STORAGE_DIR = path.join(DB_ROOT, "countries");
const STORE_FILE = path.join(STORAGE_DIR, "countries.json");
const EVENTS_FILE = path.join(STORAGE_DIR, "country-events.jsonl");

const LIMITS = {
  maxBodyBytes: 25000,
  maxList: 100
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
    countries: Array.isArray(parsed.countries) ? parsed.countries : []
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

function ok(res, payload) {
  res.status(200).json(payload);
}

function bad(res, status, error, extra = {}) {
  res.status(status).json({ success: false, error, ...extra });
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
    localGenres: body.localGenres || [],
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

  if (!countryId) {
    return bad(res, 400, "missing_countryId");
  }

  const store = await readStore();
  const country = store.countries.find(c => c.id === countryId);

  if (!country) {
    return bad(res, 404, "country_not_found");
  }

  const counters = country.counters || {};

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
    ts: nowIso()
  });

  ok(res, {
    success: true,
    message: "Country signal recorded.",
    countryId,
    type
  });
});

export default router;