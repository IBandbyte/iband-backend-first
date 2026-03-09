import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

const SERVICE = "breakouts";
const PHASE = "H12";
const VERSION = 2;

const DATA_DIR = "/var/data/iband/db";

const ARTISTS_FILE_CANDIDATES = [
  path.join(DATA_DIR, "artists", "artists.json"),
  path.join(DATA_DIR, "artists.json")
];

function readJSON(file) {
  try {
    if (!fs.existsSync(file)) return [];
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));

    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.artists)) return raw.artists;
    if (Array.isArray(raw.list)) return raw.list;
    if (Array.isArray(raw.countries)) return raw.countries;
    if (Array.isArray(raw.genres)) return raw.genres;

    return [];
  } catch {
    return [];
  }
}

function readArtists() {
  for (const file of ARTISTS_FILE_CANDIDATES) {
    if (fs.existsSync(file)) {
      return readJSON(file);
    }
  }
  return [];
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function artistBreakoutScore(artist) {
  const counters = artist?.counters || {};

  return (
    safeNum(artist?.votes) * 2 +
    safeNum(counters.shares) * 6 +
    safeNum(counters.votes) * 2 +
    safeNum(counters.purchases) * 10 +
    safeNum(counters.uploads) * 4
  );
}

function genreBreakoutScore(genre) {
  const counters = genre?.counters || {};

  return (
    safeNum(counters.shares) * 6 +
    safeNum(counters.votes) * 2 +
    safeNum(counters.purchases) * 10 +
    safeNum(counters.uploads) * 4 +
    safeNum(counters.uses)
  );
}

/*
Health check
*/
router.get("/health", (req, res) => {
  res.json({
    success: true,
    service: SERVICE,
    phase: PHASE,
    version: VERSION,
    ts: new Date().toISOString()
  });
});

/*
Breakout artists
*/
router.get("/artists", (req, res) => {
  try {
    const artists = readArtists();

    const breakout = artists
      .map((a) => ({
        id: a.id,
        name: a.name,
        genre: a.genre || null,
        location: a.location || null,
        score: artistBreakoutScore(a)
      }))
      .filter((a) => a.id && a.name && a.score > 0)
      .sort((a, b) => b.score - a.score);

    res.json({
      success: true,
      list: breakout.slice(0, 10),
      artistsLoaded: artists.length,
      ts: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "breakout_failed",
      message: err.message
    });
  }
});

/*
Breakout genres
*/
router.get("/genres", (req, res) => {
  try {
    const genresFile = path.join(DATA_DIR, "genres", "genres.json");
    const genres = readJSON(genresFile);

    const breakout = genres
      .map((g) => ({
        id: g.id,
        name: g.name,
        score: genreBreakoutScore(g)
      }))
      .filter((g) => g.id && g.name && g.score > 0)
      .sort((a, b) => b.score - a.score);

    res.json({
      success: true,
      list: breakout.slice(0, 10),
      genresLoaded: genres.length,
      ts: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "genre_breakout_failed",
      message: err.message
    });
  }
});

export default router;