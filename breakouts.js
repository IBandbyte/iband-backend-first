import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

const SERVICE = "breakouts";
const PHASE = "H12";
const VERSION = 1;

const DATA_DIR = "/var/data/iband/db";

function readJSON(file) {
  try {
    if (!fs.existsSync(file)) return [];
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));

    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.countries)) return raw.countries;
    if (Array.isArray(raw.genres)) return raw.genres;

    return [];
  } catch {
    return [];
  }
}

function momentumScore(counters) {
  if (!counters) return 0;

  return (
    (counters.shares || 0) * 6 +
    (counters.votes || 0) * 2 +
    (counters.purchases || 0) * 10 +
    (counters.uploads || 0) * 4
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

    const artistsFile = path.join(DATA_DIR, "artists/artists.json");
    const artists = readJSON(artistsFile);

    const breakout = [];

    for (const a of artists) {

      const score = momentumScore(a.counters);

      breakout.push({
        id: a.id,
        name: a.name,
        score
      });

    }

    breakout.sort((a, b) => b.score - a.score);

    res.json({
      success: true,
      list: breakout.slice(0, 10),
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

    const genresFile = path.join(DATA_DIR, "genres/genres.json");
    const genres = readJSON(genresFile);

    const breakout = [];

    for (const g of genres) {

      const score = momentumScore(g.counters);

      breakout.push({
        id: g.id,
        name: g.name,
        score
      });

    }

    breakout.sort((a, b) => b.score - a.score);

    res.json({
      success: true,
      list: breakout.slice(0, 10),
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