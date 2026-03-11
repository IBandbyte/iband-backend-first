import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Temporary in-memory stores
|--------------------------------------------------------------------------
| These will later move to database collections.
*/
const countrySignals = [];
const countryStats = {};
const countryGenreMap = {};

const REGION_MAP = {
  Balkans: [
    "Albania",
    "Bosnia and Herzegovina",
    "Bulgaria",
    "Croatia",
    "Greece",
    "Kosovo",
    "Montenegro",
    "North Macedonia",
    "Romania",
    "Serbia",
    "Slovenia",
  ],
  Latin: [
    "Argentina",
    "Bolivia",
    "Brazil",
    "Chile",
    "Colombia",
    "Costa Rica",
    "Cuba",
    "Dominican Republic",
    "Ecuador",
    "El Salvador",
    "Guatemala",
    "Honduras",
    "Mexico",
    "Nicaragua",
    "Panama",
    "Paraguay",
    "Peru",
    "Puerto Rico",
    "Uruguay",
    "Venezuela",
  ],
  Europe: [
    "United Kingdom",
    "Ireland",
    "France",
    "Germany",
    "Italy",
    "Spain",
    "Portugal",
    "Netherlands",
    "Belgium",
    "Sweden",
    "Norway",
    "Denmark",
    "Finland",
    "Poland",
    "Austria",
    "Switzerland",
    "Czech Republic",
    "Hungary",
    "Romania",
    "Bulgaria",
    "Greece",
    "Croatia",
    "Serbia",
    "Slovenia",
    "Slovakia",
    "Ukraine",
  ],
  NorthAmerica: ["United States", "Canada", "Mexico"],
  Africa: [
    "Nigeria",
    "South Africa",
    "Kenya",
    "Ghana",
    "Morocco",
    "Egypt",
    "Algeria",
    "Tunisia",
    "Ethiopia",
  ],
  Asia: [
    "Japan",
    "South Korea",
    "China",
    "India",
    "Thailand",
    "Philippines",
    "Indonesia",
    "Malaysia",
    "Vietnam",
    "Pakistan",
  ],
  Oceania: ["Australia", "New Zealand"],
  MiddleEast: [
    "United Arab Emirates",
    "Saudi Arabia",
    "Qatar",
    "Lebanon",
    "Jordan",
    "Israel",
    "Turkey",
  ],
};

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/
function normalizeCountry(country = "") {
  return String(country).trim();
}

function normalizeGenre(genre = "") {
  return String(genre).trim();
}

function normalizeAction(action = "") {
  return String(action).trim() || "view";
}

function ensureCountry(country) {
  if (!countryStats[country]) {
    countryStats[country] = {
      country,
      totalSignals: 0,
      artists: {},
      genres: {},
      actions: {},
      momentumScore: 0,
      lastActivity: new Date().toISOString(),
    };
  }
}

function getRegionForCountry(country) {
  const normalizedCountry = normalizeCountry(country);

  for (const [regionName, countries] of Object.entries(REGION_MAP)) {
    if (countries.includes(normalizedCountry)) {
      return regionName;
    }
  }

  return "Other";
}

function incrementMapCounter(obj, key, amount = 1) {
  if (!obj[key]) {
    obj[key] = 0;
  }

  obj[key] += amount;
}

function buildSortedArtistList(country) {
  if (!countryStats[country]) {
    return [];
  }

  return Object.entries(countryStats[country].artists)
    .map(([artistId, signals]) => ({
      artistId,
      signals,
    }))
    .sort((a, b) => b.signals - a.signals);
}

function buildSortedGenreList(country) {
  if (!countryStats[country]) {
    return [];
  }

  return Object.entries(countryStats[country].genres)
    .map(([genre, signals]) => ({
      genre,
      signals,
    }))
    .sort((a, b) => b.signals - a.signals);
}

function buildRegionSummary(regionName) {
  const countriesInRegion = REGION_MAP[regionName] || [];
  const ranked = countriesInRegion
    .filter((country) => countryStats[country])
    .map((country) => ({
      country,
      signals: countryStats[country].totalSignals,
      momentumScore: countryStats[country].momentumScore,
      topGenres: buildSortedGenreList(country).slice(0, 5),
      topArtists: buildSortedArtistList(country).slice(0, 5),
      lastActivity: countryStats[country].lastActivity,
    }))
    .sort((a, b) => {
      if (b.momentumScore !== a.momentumScore) {
        return b.momentumScore - a.momentumScore;
      }
      return b.signals - a.signals;
    });

  return {
    region: regionName,
    count: ranked.length,
    countries: ranked,
  };
}

/*
|--------------------------------------------------------------------------
| GET
| Root summary
|--------------------------------------------------------------------------
*/
router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "H7 Country Engine is live.",
    totals: {
      signals: countrySignals.length,
      trackedCountries: Object.keys(countryStats).length,
      trackedCountryGenreLinks: Object.keys(countryGenreMap).length,
    },
    availableRoutes: [
      "/api/country-engine",
      "/api/country-engine/countries",
      "/api/country-engine/signal",
      "/api/country-engine/trending/:country",
      "/api/country-engine/genres/:country",
      "/api/country-engine/global",
      "/api/country-engine/regions",
      "/api/country-engine/regions/:region",
      "/api/country-engine/relationships/:country",
    ],
  });
});

/*
|--------------------------------------------------------------------------
| GET
| List countries currently tracked
|--------------------------------------------------------------------------
*/
router.get("/countries", (req, res) => {
  const countries = Object.keys(countryStats)
    .map((key) => {
      const item = countryStats[key];
      return {
        country: item.country,
        region: getRegionForCountry(item.country),
        totalSignals: item.totalSignals,
        momentumScore: item.momentumScore,
        lastActivity: item.lastActivity,
      };
    })
    .sort((a, b) => {
      if (b.momentumScore !== a.momentumScore) {
        return b.momentumScore - a.momentumScore;
      }
      return b.totalSignals - a.totalSignals;
    });

  return res.json({
    success: true,
    count: countries.length,
    countries,
  });
});

/*
|--------------------------------------------------------------------------
| POST
| Record country usage signal
|--------------------------------------------------------------------------
*/
router.post("/signal", (req, res) => {
  const { artistId, country, genre, action } = req.body;

  const normalizedArtistId = String(artistId || "").trim();
  const normalizedCountry = normalizeCountry(country);
  const normalizedGenre = normalizeGenre(genre);
  const normalizedAction = normalizeAction(action);

  if (!normalizedArtistId || !normalizedCountry) {
    return res.status(400).json({
      success: false,
      message: "artistId and country are required.",
    });
  }

  const createdAt = new Date().toISOString();
  const region = getRegionForCountry(normalizedCountry);

  const signal = {
    id: `signal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    artistId: normalizedArtistId,
    country: normalizedCountry,
    region,
    genre: normalizedGenre || "unknown",
    action: normalizedAction,
    createdAt,
  };

  countrySignals.push(signal);

  ensureCountry(normalizedCountry);

  countryStats[normalizedCountry].totalSignals += 1;
  countryStats[normalizedCountry].momentumScore += 1;
  countryStats[normalizedCountry].lastActivity = createdAt;

  incrementMapCounter(countryStats[normalizedCountry].artists, normalizedArtistId, 1);
  incrementMapCounter(countryStats[normalizedCountry].actions, normalizedAction, 1);

  if (normalizedGenre) {
    incrementMapCounter(countryStats[normalizedCountry].genres, normalizedGenre, 1);

    if (!countryGenreMap[normalizedCountry]) {
      countryGenreMap[normalizedCountry] = {};
    }

    incrementMapCounter(countryGenreMap[normalizedCountry], normalizedGenre, 1);
  }

  return res.json({
    success: true,
    message: "Country signal recorded.",
    signal,
    countrySnapshot: {
      country: normalizedCountry,
      region,
      totalSignals: countryStats[normalizedCountry].totalSignals,
      momentumScore: countryStats[normalizedCountry].momentumScore,
      topArtists: buildSortedArtistList(normalizedCountry).slice(0, 5),
      topGenres: buildSortedGenreList(normalizedCountry).slice(0, 5),
    },
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Trending artists for a country
|--------------------------------------------------------------------------
*/
router.get("/trending/:country", (req, res) => {
  const country = normalizeCountry(req.params.country);

  if (!countryStats[country]) {
    return res.json({
      success: true,
      country,
      region: getRegionForCountry(country),
      artists: [],
    });
  }

  return res.json({
    success: true,
    country,
    region: getRegionForCountry(country),
    totalSignals: countryStats[country].totalSignals,
    momentumScore: countryStats[country].momentumScore,
    artists: buildSortedArtistList(country),
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Genres trending in a country
|--------------------------------------------------------------------------
*/
router.get("/genres/:country", (req, res) => {
  const country = normalizeCountry(req.params.country);

  if (!countryStats[country]) {
    return res.json({
      success: true,
      country,
      region: getRegionForCountry(country),
      genres: [],
    });
  }

  return res.json({
    success: true,
    country,
    region: getRegionForCountry(country),
    totalSignals: countryStats[country].totalSignals,
    genres: buildSortedGenreList(country),
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Global country activity ranking
|--------------------------------------------------------------------------
*/
router.get("/global", (req, res) => {
  const ranking = Object.values(countryStats)
    .map((c) => ({
      country: c.country,
      region: getRegionForCountry(c.country),
      signals: c.totalSignals,
      momentumScore: c.momentumScore,
      lastActivity: c.lastActivity,
    }))
    .sort((a, b) => {
      if (b.momentumScore !== a.momentumScore) {
        return b.momentumScore - a.momentumScore;
      }
      return b.signals - a.signals;
    });

  return res.json({
    success: true,
    count: ranking.length,
    countries: ranking,
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Region list summary
|--------------------------------------------------------------------------
*/
router.get("/regions", (req, res) => {
  const regions = Object.keys(REGION_MAP).map((regionName) => {
    const summary = buildRegionSummary(regionName);
    return {
      region: regionName,
      trackedCountries: summary.count,
      countries: summary.countries,
    };
  });

  return res.json({
    success: true,
    count: regions.length,
    regions,
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Region detail
|--------------------------------------------------------------------------
*/
router.get("/regions/:region", (req, res) => {
  const requestedRegion = String(req.params.region || "").trim();
  const matchedRegion = Object.keys(REGION_MAP).find(
    (regionName) => regionName.toLowerCase() === requestedRegion.toLowerCase()
  );

  if (!matchedRegion) {
    return res.status(404).json({
      success: false,
      message: "Region not found.",
      availableRegions: Object.keys(REGION_MAP),
    });
  }

  return res.json({
    success: true,
    ...buildRegionSummary(matchedRegion),
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Country -> Genre relationships
|--------------------------------------------------------------------------
*/
router.get("/relationships/:country", (req, res) => {
  const country = normalizeCountry(req.params.country);
  const relationships = countryGenreMap[country] || {};

  const rankedRelationships = Object.entries(relationships)
    .map(([genre, signals]) => ({
      country,
      genre,
      signals,
      region: getRegionForCountry(country),
    }))
    .sort((a, b) => b.signals - a.signals);

  return res.json({
    success: true,
    country,
    region: getRegionForCountry(country),
    relationships: rankedRelationships,
  });
});

export default router;