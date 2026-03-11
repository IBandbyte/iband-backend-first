const express = require("express");

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

/*
|--------------------------------------------------------------------------
| Helper: ensure country bucket exists
|--------------------------------------------------------------------------
*/

function ensureCountry(country) {
  if (!countryStats[country]) {
    countryStats[country] = {
      country,
      totalSignals: 0,
      artists: {},
      genres: {},
      lastActivity: new Date().toISOString()
    };
  }
}

/*
|--------------------------------------------------------------------------
| GET
| List countries currently tracked
|--------------------------------------------------------------------------
*/

router.get("/countries", (req, res) => {
  const countries = Object.keys(countryStats).map((key) => countryStats[key]);

  return res.json({
    success: true,
    count: countries.length,
    countries
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

  if (!artistId || !country) {
    return res.status(400).json({
      success: false,
      message: "artistId and country are required."
    });
  }

  const signal = {
    id: `signal_${Date.now()}`,
    artistId,
    country,
    genre: genre || "unknown",
    action: action || "view",
    createdAt: new Date().toISOString()
  };

  countrySignals.push(signal);

  ensureCountry(country);

  countryStats[country].totalSignals += 1;
  countryStats[country].lastActivity = signal.createdAt;

  if (!countryStats[country].artists[artistId]) {
    countryStats[country].artists[artistId] = 0;
  }

  countryStats[country].artists[artistId] += 1;

  if (genre) {
    if (!countryStats[country].genres[genre]) {
      countryStats[country].genres[genre] = 0;
    }

    countryStats[country].genres[genre] += 1;

    if (!countryGenreMap[country]) {
      countryGenreMap[country] = {};
    }

    if (!countryGenreMap[country][genre]) {
      countryGenreMap[country][genre] = 0;
    }

    countryGenreMap[country][genre] += 1;
  }

  return res.json({
    success: true,
    message: "Country signal recorded.",
    signal
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Trending artists for a country
|--------------------------------------------------------------------------
*/

router.get("/trending/:country", (req, res) => {
  const { country } = req.params;

  if (!countryStats[country]) {
    return res.json({
      success: true,
      country,
      artists: []
    });
  }

  const artists = Object.entries(countryStats[country].artists)
    .map(([artistId, signals]) => ({
      artistId,
      signals
    }))
    .sort((a, b) => b.signals - a.signals);

  return res.json({
    success: true,
    country,
    artists
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Genres trending in a country
|--------------------------------------------------------------------------
*/

router.get("/genres/:country", (req, res) => {
  const { country } = req.params;

  if (!countryStats[country]) {
    return res.json({
      success: true,
      country,
      genres: []
    });
  }

  const genres = Object.entries(countryStats[country].genres)
    .map(([genre, count]) => ({
      genre,
      signals: count
    }))
    .sort((a, b) => b.signals - a.signals);

  return res.json({
    success: true,
    country,
    genres
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
      signals: c.totalSignals
    }))
    .sort((a, b) => b.signals - a.signals);

  return res.json({
    success: true,
    countries: ranking
  });
});

module.exports = router;