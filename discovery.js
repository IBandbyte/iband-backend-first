import express from "express";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";

const router = express.Router();

const SERVICE = "discovery";
const PHASE = "H9.1";
const VERSION = 2;

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
    .map(l => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
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

/* ---------- WORLD MUSIC MAP ---------- */

router.get("/world-map", async (req, res) => {

  const countries = await readJson(COUNTRIES_FILE);
  const genres = await readJson(GENRES_FILE);
  const artists = await readArtists();

  const genreEvents = await scanEvents(GENRE_EVENTS);
  const countryEvents = await scanEvents(COUNTRY_EVENTS);

  const genreScores = {};
  const artistScores = {};
  const countryScores = {};

  const now = Date.now();

  for (const ev of genreEvents) {

    const ts = Date.parse(ev.ts || "");
    if (!ts) continue;

    const ageDays = (now - ts) / (1000 * 60 * 60 * 24);
    const weight = decay(ageDays);

    const id = ev.genreId;
    if (!id) continue;

    genreScores[id] = (genreScores[id] || 0) + weight;

  }

  for (const ev of countryEvents) {

    const ts = Date.parse(ev.ts || "");
    if (!ts) continue;

    const ageDays = (now - ts) / (1000 * 60 * 60 * 24);
    const weight = decay(ageDays);

    if (ev.artistId) {
      artistScores[ev.artistId] = (artistScores[ev.artistId] || 0) + weight;
    }

    if (ev.countryId) {
      countryScores[ev.countryId] = (countryScores[ev.countryId] || 0) + weight;
    }

  }

  const result = countries.map(country => {

    const topArtist = artists
      .map(a => ({
        id: a.id,
        name: a.name,
        score: artistScores[a.id] || 0
      }))
      .sort((a,b)=> b.score - a.score)[0];

    const topGenre = genres
      .map(g => ({
        id: g.id,
        name: g.name,
        score: genreScores[g.id] || 0
      }))
      .sort((a,b)=> b.score - a.score)[0];

    return {
      country: country.name,
      flag: country.flag,
      topArtist: topArtist ? topArtist.name : null,
      topGenre: topGenre ? topGenre.name : null,
      activity: countryScores[country.id] || 0
    };

  });

  const ranked = result.sort((a,b)=> b.activity - a.activity);

  res.json({
    success: true,
    countries: ranked.slice(0,20),
    ts: nowIso()
  });

});

export default router;