import express from "express";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";

const router = express.Router();

const SERVICE = "discovery";
const PHASE = "H9.3";
const VERSION = 4;

const DB_ROOT = process.env.IBAND_DATA_DIR || "/var/data/iband/db";

const GENRES_FILE = path.join(DB_ROOT, "genres/genres.json");
const COUNTRIES_FILE = path.join(DB_ROOT, "countries/countries.json");

const GENRE_EVENTS = path.join(DB_ROOT, "genres/events/genre-events.jsonl");
const COUNTRY_EVENTS = path.join(DB_ROOT, "countries/country-events.jsonl");

const ARTISTS_FILE_CANDIDATES = [
  path.join(DB_ROOT, "artists/artists.json"),
  path.join(DB_ROOT, "artists.json")
];

const LIMITS = {
  maxReadBytes: 20 * 1024 * 1024
};

const HALF_LIFE_DAYS = 14;

function nowIso() {
  return new Date().toISOString();
}

function decay(ageDays) {
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
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

async function readArtists() {
  for (const file of ARTISTS_FILE_CANDIDATES) {
    if (fs.existsSync(file)) {
      return await readJson(file);
    }
  }
  return [];
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
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function scoreById(events, idField) {

  const scores = {};
  const now = Date.now();

  for (const ev of events) {

    const ts = Date.parse(ev.ts || "");
    if (!ts) continue;

    const id = ev[idField];
    if (!id) continue;

    const ageDays = (now - ts) / (1000 * 60 * 60 * 24);
    const weight = decay(ageDays);

    scores[id] = (scores[id] || 0) + weight;
  }

  return scores;
}

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

/* ---------- COUNTRY GENRES ---------- */

router.get("/country/:countryId/genres", async (req, res) => {

  const countryId = req.params.countryId;

  const countries = await readJson(COUNTRIES_FILE);
  const genres = await readJson(GENRES_FILE);

  const country = countries.find(c => c.id === countryId);

  if (!country) {
    return res.status(404).json({
      success: false,
      error: "country_not_found"
    });
  }

  const genreEvents = await scanEvents(GENRE_EVENTS);
  const countryEvents = await scanEvents(COUNTRY_EVENTS);

  const genreScores = scoreById(genreEvents, "genreId");

  const countryGenreScores = {};

  for (const ev of countryEvents) {

    if (ev.countryId !== countryId) continue;

    if (!ev.genreId) continue;

    const ts = Date.parse(ev.ts || "");
    if (!ts) continue;

    const ageDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
    const weight = decay(ageDays);

    countryGenreScores[ev.genreId] =
      (countryGenreScores[ev.genreId] || 0) + weight;

  }

  const ranked = genres
    .map(g => ({
      id: g.id,
      name: g.name,
      score:
        (countryGenreScores[g.id] || 0) +
        ((genreScores[g.id] || 0) * 0.25)
    }))
    .sort((a,b)=> b.score - a.score)
    .filter(g => g.score > 0);

  res.json({
    success: true,
    country: country.name,
    flag: country.flag,
    genres: ranked.slice(0,10),
    ts: nowIso()
  });

});

export default router;