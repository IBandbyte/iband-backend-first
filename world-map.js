import fs from "fs";
import path from "path";

const DATA_DIR = "/var/data/iband/db";
const COUNTRIES_FILE = path.join(DATA_DIR, "countries/countries.json");
const GENRES_FILE = path.join(DATA_DIR, "genres/genres.json");

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    return [];
  }
}

function calculateCountryActivity(country) {
  if (!country.counters) return 0;

  const c = country.counters;

  return (
    (c.shares || 0) * 6 +
    (c.votes || 0) * 2 +
    (c.purchases || 0) * 10 +
    (c.uploads || 0) * 4
  );
}

export function worldMapDiscovery(req, res) {
  try {
    const countries = readJSON(COUNTRIES_FILE);
    const genres = readJSON(GENRES_FILE);

    const regionMap = {};

    for (const country of countries) {
      const region = country.subregion || country.region || "Other";

      if (!regionMap[region]) {
        regionMap[region] = {
          region,
          countries: []
        };
      }

      const activity = calculateCountryActivity(country);

      const topGenre =
        country.localGenres && country.localGenres.length
          ? country.localGenres[0]
          : null;

      regionMap[region].countries.push({
        name: country.name,
        flag: country.flag || "",
        code: country.code,
        activity,
        topGenre
      });
    }

    const regions = Object.values(regionMap);

    res.json({
      success: true,
      regions,
      meta: {
        regions: regions.length,
        ts: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "world_map_failed",
      message: err.message
    });
  }
}