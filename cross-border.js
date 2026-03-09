import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

const SERVICE = "cross-border";
const PHASE = "H13";
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

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function countryScore(c) {
  const counters = c?.counters || {};

  return (
    safeNum(counters.shares) * 6 +
    safeNum(counters.votes) * 2 +
    safeNum(counters.purchases) * 10 +
    safeNum(counters.uploads) * 4
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
Cross-border genre spread
*/
router.get("/genres", (req, res) => {

  try {

    const countriesFile = path.join(DATA_DIR, "countries/countries.json");
    const countries = readJSON(countriesFile);

    const spread = [];

    for (const c of countries) {

      const genres = c.localGenres || [];

      for (const g of genres) {

        spread.push({
          country: c.name,
          flag: c.flag || "",
          genre: g,
          score: countryScore(c)
        });

      }

    }

    spread.sort((a, b) => b.score - a.score);

    res.json({
      success: true,
      list: spread.slice(0, 10),
      countriesLoaded: countries.length,
      ts: new Date().toISOString()
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      error: "cross_border_failed",
      message: err.message
    });

  }

});

export default router;