import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

const SERVICE = "world-map";
const PHASE = "H11";
const VERSION = 1;

const DATA_DIR = "/var/data/iband/db";

function readJSON(file) {
  try {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
}

function countryActivity(c) {
  const x = c?.counters || {};
  return (
    (x.shares || 0) * 6 +
    (x.votes || 0) * 2 +
    (x.purchases || 0) * 10 +
    (x.uploads || 0) * 4
  );
}

router.get("/health", (req, res) => {
  res.json({
    success: true,
    service: SERVICE,
    phase: PHASE,
    version: VERSION,
    ts: new Date().toISOString()
  });
});

router.get("/", (req, res) => {
  try {
    const countriesFile = path.join(DATA_DIR, "countries/countries.json");
    const countries = readJSON(countriesFile);

    const regions = {};

    for (const c of countries) {
      const region = c.subregion || c.region || "Other";

      if (!regions[region]) {
        regions[region] = {
          region,
          countries: []
        };
      }

      regions[region].countries.push({
        name: c.name,
        code: c.code,
        flag: c.flag || "",
        activity: countryActivity(c),
        topGenre: c.localGenres?.[0] || null
      });
    }

    res.json({
      success: true,
      regions: Object.values(regions),
      ts: new Date().toISOString()
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: "world_map_failed",
      message: err.message
    });
  }
});

export default router;