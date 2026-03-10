import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

const SERVICE = "discovery-boost";
const PHASE = "H20";
const VERSION = 1;

const DATA_DIR = "/var/data/iband/db";

const ARTISTS_FILE_CANDIDATES = [
  path.join(DATA_DIR, "artists", "artists.json"),
  path.join(DATA_DIR, "artists.json")
];

const SHARES_FILE = path.join(DATA_DIR, "shares", "events", "shares.jsonl");
const PURCHASES_FILE = path.join(DATA_DIR, "purchases", "events", "purchases.jsonl");

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

function readJSONL(file) {
  try {
    if (!fs.existsSync(file)) return [];

    const raw = fs.readFileSync(file, "utf8");
    if (!raw) return [];

    return raw
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
  } catch {
    return [];
  }
}

function safeTs(v) {
  const t = Date.parse(v || "");
  return Number.isFinite(t) ? t : null;
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

function chartScore(popularityScore, momentumScore) {
  return popularityScore * 0.3 + momentumScore * 0.7;
}

function computeSurgeMap() {
  const shareEvents = readJSONL(SHARES_FILE);
  const purchaseEvents = readJSONL(PURCHASES_FILE);

  const now = Date.now();
  const oneHourMs = 60 * 60 * 1000;

  const map = {};

  function ensureArtist(artistId) {
    if (!artistId) return null;
    if (!map[artistId]) {
      map[artistId] = {
        artistId,
        shareSignals: 0,
        purchaseSignals: 0,
        surgeScore: 0
      };
    }
    return map[artistId];
  }

  for (const ev of shareEvents) {
    const ts = safeTs(ev?.ts);
    if (!ts) continue;
    if (now - ts > oneHourMs) continue;

    const row = ensureArtist(ev.artistId);
    if (!row) continue;

    row.shareSignals += 1;
    row.surgeScore += 6;
  }

  for (const ev of purchaseEvents) {
    const ts = safeTs(ev?.ts);
    if (!ts) continue;
    if (now - ts > oneHourMs) continue;

    const row = ensureArtist(ev.artistId);
    if (!row) continue;

    row.purchaseSignals += 1;
    row.surgeScore += 10;
  }

  return map;
}

function computeBreakoutScore(artist) {
  const counters = artist?.counters || {};

  return (
    safeNum(artist?.votes) * 2 +
    safeNum(counters.shares) * 6 +
    safeNum(counters.votes) * 2 +
    safeNum(counters.purchases) * 10 +
    safeNum(counters.uploads) * 4
  );
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
      shares: {
        path: SHARES_FILE,
        ok: fs.existsSync(SHARES_FILE)
      },
      purchases: {
        path: PURCHASES_FILE,
        ok: fs.existsSync(PURCHASES_FILE)
      }
    },
    ts: new Date().toISOString()
  });
});

/*
Boosted artist discovery ranking
*/
router.get("/artists", (req, res) => {
  try {
    const artists = readArtists();
    const surgeMap = computeSurgeMap();

    const list = artists
      .map((artist) => {
        const popularityScore = artistPopularityScore(artist);
        const momentumScore = artistMomentumScore(artist);
        const momentumChartScore = chartScore(popularityScore, momentumScore);
        const breakoutScore = computeBreakoutScore(artist);
        const surgeScore = safeNum(surgeMap[artist.id]?.surgeScore);

        const boostScore =
          momentumChartScore * 0.5 +
          breakoutScore * 0.3 +
          surgeScore * 0.2;

        return {
          id: artist.id,
          name: artist.name,
          genre: artist.genre || null,
          location: artist.location || null,
          popularityScore,
          momentumScore,
          momentumChartScore,
          breakoutScore,
          surgeScore,
          boostScore
        };
      })
      .filter((row) => row.id && row.name && row.boostScore > 0)
      .sort((a, b) => b.boostScore - a.boostScore)
      .map((row, index) => ({
        rank: index + 1,
        ...row
      }));

    res.json({
      success: true,
      list: list.slice(0, 50),
      artistsLoaded: artists.length,
      ts: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "discovery_boost_failed",
      message: err.message
    });
  }
});

export default router;