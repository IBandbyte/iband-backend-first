import express from "express";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";

const router = express.Router();

const SERVICE = "discovery";
const PHASE = "H9.2";
const VERSION = 3;

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

/* ---------- GLOBAL GENRES ---------- */

router.get("/global/genres", async (req, res) => {
  const genres = await readJson(GENRES_FILE);
  const genreEvents = await scanEvents(GENRE_EVENTS);

  const genreScores = scoreById(genreEvents, "genreId");

  const ranked = genres
    .map((g) => ({
      id: g.id,
      name: g.name,
      score: genreScores[g.id] || 0
    }))
    .sort((a, b) => b.score - a.score);

  res.json({
    success: true,
    list: ranked.slice(0, 10),
    ts: nowIso()
  });
});

/* ---------- GLOBAL ARTISTS ---------- */

router.get("/global/artists", async (req, res) => {
  const artists = await readArtists();
  const countryEvents = await scanEvents(COUNTRY_EVENTS);

  const artistScores = scoreById(countryEvents, "artistId");

  const ranked = artists
    .map((a) => ({
      id: a.id,
      name: a.name,
      score: artistScores[a.id] || 0
    }))
    .sort((a, b) => b.score - a.score);

  res.json({
    success: true,
    list: ranked.slice(0, 10),
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

  const genreScores = scoreById(genreEvents, "genreId");
  const artistScores = scoreById(countryEvents, "artistId");
  const countryScores = scoreById(countryEvents, "countryId");

  const result = countries.map((country) => {
    const topArtist = artists
      .map((a) => ({
        id: a.id,
        name: a.name,
        score: artistScores[a.id] || 0
      }))
      .sort((a, b) => b.score - a.score)[0];

    const topGenre = genres
      .map((g) => ({
        id: g.id,
        name: g.name,
        score: genreScores[g.id] || 0
      }))
      .sort((a, b) => b.score - a.score)[0];

    return {
      country: country.name,
      countryId: country.id,
      flag: country.flag,
      region: country.region || null,
      subregion: country.subregion || null,
      topArtist: topArtist ? topArtist.name : null,
      topGenre: topGenre ? topGenre.name : null,
      activity: countryScores[country.id] || 0
    };
  });

  const ranked = result.sort((a, b) => b.activity - a.activity);

  res.json({
    success: true,
    countries: ranked.slice(0, 20),
    ts: nowIso()
  });
});

/* ---------- REGION DISCOVERY ---------- */

router.get("/region/:subregion", async (req, res) => {
  const subregion = (req.params.subregion || "").toString().trim().toLowerCase();

  const countries = await readJson(COUNTRIES_FILE);
  const genres = await readJson(GENRES_FILE);
  const artists = await readArtists();

  const genreEvents = await scanEvents(GENRE_EVENTS);
  const countryEvents = await scanEvents(COUNTRY_EVENTS);

  const regionCountries = countries.filter(
    (c) => ((c.subregion || c.region || "").toString().trim().toLowerCase() === subregion)
  );

  if (regionCountries.length === 0) {
    return res.status(404).json({
      success: false,
      error: "region_not_found",
      subregion: req.params.subregion
    });
  }

  const regionCountryIds = new Set(regionCountries.map((c) => c.id));

  const filteredCountryEvents = countryEvents.filter(
    (ev) => ev.countryId && regionCountryIds.has(ev.countryId)
  );

  const artistScores = scoreById(filteredCountryEvents, "artistId");
  const countryScores = scoreById(filteredCountryEvents, "countryId");

  // We do not yet have genre->country linkage in events, so use global genre momentum for now.
  // This is a correct foundation and H9.3 can localize genre scoring further.
  const genreScores = scoreById(genreEvents, "genreId");

  const topArtists = artists
    .map((a) => ({
      id: a.id,
      name: a.name,
      score: artistScores[a.id] || 0
    }))
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const topGenres = genres
    .map((g) => ({
      id: g.id,
      name: g.name,
      score: genreScores[g.id] || 0
    }))
    .filter((g) => g.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const countryBreakdown = regionCountries
    .map((c) => ({
      id: c.id,
      name: c.name,
      flag: c.flag || null,
      activity: countryScores[c.id] || 0,
      localGenres: Array.isArray(c.localGenres) ? c.localGenres : []
    }))
    .sort((a, b) => b.activity - a.activity);

  res.json({
    success: true,
    region: req.params.subregion,
    countries: countryBreakdown,
    topArtists,
    topGenres,
    ts: nowIso()
  });
});

export default router;