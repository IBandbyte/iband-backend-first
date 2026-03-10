import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

const SERVICE = "momentum-charts";
const PHASE = "H18";
const VERSION = 1;

const DATA_DIR = "/var/data/iband/db";

const ARTISTS_FILE_CANDIDATES = [
  path.join(DATA_DIR, "artists", "artists.json"),
  path.join(DATA_DIR, "artists.json")
];

const GENRES_FILE = path.join(DATA_DIR, "genres", "genres.json");

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function readJSON(file) {
  try {
    if (!fs.existsSync(file)) return [];
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));

    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.artists)) return raw.artists;
    if (Array.isArray(raw.genres)) return raw.genres;
    if (Array.isArray(raw.list)) return raw.list;

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

function artistPopularityScore(artist) {
  const counters = artist?.counters || {};

  return (
    safeNum(artist?.views) * 1 +
    safeNum(artist?.streams) * 2 +
    safeNum(artist?.likes) * 1 +
    safeNum(artist?.votes) * 1 +
    safeNum(counters.views) * 1 +
    safeNum(counters.streams) * 2 +
    safeNum(counters.likes) * 1
  );
}

function artistMomentumScore(artist) {
  const counters = artist?.counters || {};

  return (
    safeNum(artist?.shares) * 6 +
    safeNum(artist?.votes) * 2 +
    safeNum(artist?.purchases) * 10 +
    safeNum(artist?.uploads) * 4 +
    safeNum(counters.shares) * 6 +
    safeNum(counters.votes) * 2 +
    safeNum(counters.purchases) * 10 +
    safeNum(counters.uploads) * 4
  );
}

function genrePopularityScore(genre) {
  const counters = genre?.counters || {};

  return (
    safeNum(counters.uses) * 1 +
    safeNum(counters.votes) * 1
  );
}

function genreMomentumScore(genre) {
  const counters = genre?.counters || {};

  return (
    safeNum(counters.shares) * 6 +
    safeNum(counters.votes) * 2 +
    safeNum(counters.purchases) * 10 +
    safeNum(counters.uploads) * 4 +
    safeNum(counters.roomPosts) * 1 +
    safeNum(counters.uses) * 1
  );
}

function ibandChartScore(popularityScore, momentumScore) {
  return popularityScore * 0.3 + momentumScore * 0.7;
}

/*
Health
*/
router.get("/health", (req, res) => {
  res.json({
    success: true,
    service: SERVICE,
    phase: PHASE,
    version: VERSION,
    files: {
      artistsCandidates: ARTISTS_FILE_CANDIDATES,
      genres: {
        path: GENRES_FILE,
        ok: fs.existsSync(GENRES_FILE)
      }
    },
    ts: new Date().toISOString()
  });
});

/*
Artist Momentum Charts
*/
router.get("/artists", (req, res) => {
  try {
    const artists = readArtists();

    const list = artists
      .map((artist) => {
        const popularityScore = artistPopularityScore(artist);
        const momentumScore = artistMomentumScore(artist);
        const chartScore = ibandChartScore(popularityScore, momentumScore);

        return {
          id: artist.id,
          name: artist.name,
          genre: artist.genre || null,
          location: artist.location || null,
          popularityScore,
          momentumScore,
          ibandChartScore: chartScore
        };
      })
      .filter((row) => row.id && row.name && row.ibandChartScore > 0)
      .sort((a, b) => b.ibandChartScore - a.ibandChartScore)
      .map((row, index) => ({
        rank: index + 1,
        ...row
      }));

    res.json({
      success: true,
      chart: "artists",
      list: list.slice(0, 50),
      artistsLoaded: artists.length,
      ts: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "artist_momentum_chart_failed",
      message: err.message
    });
  }
});

/*
Genre Momentum Charts
*/
router.get("/genres", (req, res) => {
  try {
    const genres = readJSON(GENRES_FILE);

    const list = genres
      .map((genre) => {
        const popularityScore = genrePopularityScore(genre);
        const momentumScore = genreMomentumScore(genre);
        const chartScore = ibandChartScore(popularityScore, momentumScore);

        return {
          id: genre.id,
          name: genre.name,
          popularityScore,
          momentumScore,
          ibandChartScore: chartScore
        };
      })
      .filter((row) => row.id && row.name && row.ibandChartScore > 0)
      .sort((a, b) => b.ibandChartScore - a.ibandChartScore)
      .map((row, index) => ({
        rank: index + 1,
        ...row
      }));

    res.json({
      success: true,
      chart: "genres",
      list: list.slice(0, 50),
      genresLoaded: genres.length,
      ts: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "genre_momentum_chart_failed",
      message: err.message
    });
  }
});

export default router;