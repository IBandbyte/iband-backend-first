import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

const SERVICE = "rising-now";
const PHASE = "H21";
const VERSION = 1;

const DATA_DIR = "/var/data/iband/db";

const ARTISTS_FILE_CANDIDATES = [
  path.join(DATA_DIR, "artists", "artists.json"),
  path.join(DATA_DIR, "artists.json")
];

const SHARES_FILE = path.join(DATA_DIR, "shares", "events", "shares.jsonl");

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
      }
    },
    ts: new Date().toISOString()
  });
});

/*
Rising Now feed
*/
router.get("/artists", (req, res) => {
  try {
    const artists = readArtists();
    const shareEvents = readJSONL(SHARES_FILE);

    const now = Date.now();
    const sixHourWindow = 6 * 60 * 60 * 1000;

    const activity = {};

    function ensureArtist(id) {
      if (!id) return null;

      if (!activity[id]) {
        activity[id] = {
          artistId: id,
          shares: 0,
          score: 0
        };
      }

      return activity[id];
    }

    for (const ev of shareEvents) {
      const ts = safeTs(ev?.ts);
      if (!ts) continue;

      if (now - ts > sixHourWindow) continue;

      const row = ensureArtist(ev.artistId);
      if (!row) continue;

      row.shares += 1;
      row.score += 6;
    }

    const artistMap = {};
    for (const a of artists) {
      artistMap[a.id] = a;
    }

    const list = Object.values(activity)
      .map((row) => {
        const artist = artistMap[row.artistId] || {};

        return {
          artistId: row.artistId,
          name: artist.name || null,
          genre: artist.genre || null,
          location: artist.location || null,
          shareSignals: row.shares,
          risingScore: row.score
        };
      })
      .filter((r) => r.name)
      .sort((a, b) => b.risingScore - a.risingScore)
      .map((r, i) => ({
        rank: i + 1,
        ...r
      }));

    res.json({
      success: true,
      feed: "rising-now",
      window: "6h",
      list: list.slice(0, 25),
      artistsDetected: list.length,
      ts: new Date().toISOString()
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: "rising_feed_failed",
      message: err.message
    });
  }
});

export default router;