import express from "express";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";

const router = express.Router();

const SERVICE = "discovery";
const PHASE = "H8";
const VERSION = 1;

const DB_ROOT = process.env.IBAND_DATA_DIR || "/var/data/iband/db";

const GENRE_EVENTS = path.join(DB_ROOT, "genres/events/genre-events.jsonl");
const COUNTRY_EVENTS = path.join(DB_ROOT, "countries/country-events.jsonl");

const GENRES_FILE = path.join(DB_ROOT, "genres/genres.json");
const COUNTRIES_FILE = path.join(DB_ROOT, "countries/countries.json");

const ARTISTS_FILE_CANDIDATES = [
  path.join(DB_ROOT, "artists/artists.json"),
  path.join(DB_ROOT, "artists.json")
];

const LIMITS = {
  maxReadBytes: 20 * 1024 * 1024,
  maxLineScan: 200000
};

const TUNING = {
  weights: {
    share: 6,
    vote: 2,
    purchase: 10,
    upload: 4,
    room_post: 1,
    other: 1
  },
  halfLifeDays: 14,
  maxLookbackDays: 120
};

function nowIso() {
  return new Date().toISOString();
}

function decay(ageDays) {
  return Math.pow(0.5, ageDays / TUNING.halfLifeDays);
}

async function readJson(file) {
  try {
    const raw = await fsp.readFile(file, "utf8");
    const data = JSON.parse(raw || "{}");
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.genres)) return data.genres;
    if (Array.isArray(data.countries)) return data.countries;
    if (Array.isArray(data.artists)) return data.artists;
    return [];
  } catch {
    return [];
  }
}

async function scanEvents(file) {
  if (!fs.existsSync(file)) return [];

  const stat = fs.statSync(file);
  const readBytes = Math.min(stat.size, LIMITS.maxReadBytes);

  const fd = await fsp.open(file, "r");
  const buf = Buffer.alloc(readBytes);
  await fd.read(buf, 0, readBytes, Math.max(0, stat.size - readBytes));
  await fd.close();

  return buf
    .toString("utf8")
    .split("\n")
    .filter(Boolean)
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/* ---------- HEALTH ---------- */

router.get("/health", async (req, res) => {

  const genres = await readJson(GENRES_FILE);
  const countries = await readJson(COUNTRIES_FILE);

  res.json({
    success: true,
    service: SERVICE,
    phase: PHASE,
    version: VERSION,
    store: {
      genres: genres.length,
      countries: countries.length
    },
    ts: nowIso()
  });

});

/* ---------- GLOBAL GENRES ---------- */

router.get("/global/genres", async (req, res) => {

  const genres = await readJson(GENRES_FILE);
  const events = await scanEvents(GENRE_EVENTS);

  const scores = {};

  const now = Date.now();

  for (const ev of events) {

    const ts = Date.parse(ev.ts || "");
    if (!ts) continue;

    const ageDays = (now - ts) / (1000 * 60 * 60 * 24);
    const weight = decay(ageDays);

    const id = ev.genreId;
    if (!id) continue;

    scores[id] = (scores[id] || 0) + weight;

  }

  const ranked = genres
    .map(g => ({
      id: g.id,
      name: g.name,
      score: scores[g.id] || 0
    }))
    .sort((a,b)=> b.score - a.score);

  res.json({
    success: true,
    list: ranked.slice(0,10),
    ts: nowIso()
  });

});

/* ---------- GLOBAL ARTISTS ---------- */

router.get("/global/artists", async (req, res) => {

  let artists = [];

  for (const file of ARTISTS_FILE_CANDIDATES) {
    if (fs.existsSync(file)) {
      artists = await readJson(file);
      break;
    }
  }

  const events = await scanEvents(COUNTRY_EVENTS);

  const scores = {};
  const now = Date.now();

  for (const ev of events) {

    const ts = Date.parse(ev.ts || "");
    if (!ts) continue;

    const ageDays = (now - ts) / (1000 * 60 * 60 * 24);
    const weight = decay(ageDays);

    const id = ev.artistId;
    if (!id) continue;

    scores[id] = (scores[id] || 0) + weight;

  }

  const ranked = artists
    .map(a => ({
      id: a.id,
      name: a.name,
      score: scores[a.id] || 0
    }))
    .sort((a,b)=> b.score - a.score);

  res.json({
    success: true,
    list: ranked.slice(0,10),
    ts: nowIso()
  });

});

export default router;