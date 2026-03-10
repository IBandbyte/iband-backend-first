import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

const SERVICE = "trend-starter";
const PHASE = "H17";
const VERSION = 1;

const DATA_DIR = "/var/data/iband/db";
const SHARES_FILE = path.join(DATA_DIR, "shares", "events", "shares.jsonl");

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

function validTs(value) {
  const ts = Date.parse(value || "");
  return Number.isFinite(ts) ? ts : null;
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
      shares: {
        path: SHARES_FILE,
        ok: fs.existsSync(SHARES_FILE)
      }
    },
    ts: new Date().toISOString()
  });
});

/*
Global trend starters by earliest valid share per artist
*/
router.get("/global", (req, res) => {
  try {
    const shareEvents = readJSONL(SHARES_FILE);

    const earliestByArtist = {};

    for (const ev of shareEvents) {
      if (!ev?.artistId) continue;
      if (!ev?.fanId) continue;

      const ts = validTs(ev.ts);
      if (!ts) continue;

      const current = earliestByArtist[ev.artistId];

      if (!current || ts < current.tsMs) {
        earliestByArtist[ev.artistId] = {
          artistId: ev.artistId,
          fanId: ev.fanId,
          ts: ev.ts,
          tsMs: ts,
          eventId: ev.id || null,
          platform: ev.platform || null
        };
      }
    }

    const list = Object.values(earliestByArtist)
      .map((row) => ({
        artistId: row.artistId,
        trendStarterFanId: row.fanId,
        ts: row.ts,
        eventId: row.eventId,
        platform: row.platform
      }))
      .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));

    res.json({
      success: true,
      list,
      artistsResolved: list.length,
      ts: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "trend_starter_global_failed",
      message: err.message
    });
  }
});

/*
Trend starter for a specific artist
*/
router.get("/artist/:artistId", (req, res) => {
  try {
    const { artistId } = req.params;
    const shareEvents = readJSONL(SHARES_FILE);

    let earliest = null;

    for (const ev of shareEvents) {
      if (ev?.artistId !== artistId) continue;
      if (!ev?.fanId) continue;

      const ts = validTs(ev.ts);
      if (!ts) continue;

      if (!earliest || ts < earliest.tsMs) {
        earliest = {
          artistId,
          trendStarterFanId: ev.fanId,
          ts: ev.ts,
          tsMs: ts,
          eventId: ev.id || null,
          platform: ev.platform || null
        };
      }
    }

    res.json({
      success: true,
      artistId,
      trendStarter: earliest
        ? {
            fanId: earliest.trendStarterFanId,
            ts: earliest.ts,
            eventId: earliest.eventId,
            platform: earliest.platform
          }
        : null,
      ts: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "trend_starter_artist_failed",
      message: err.message
    });
  }
});

export default router;