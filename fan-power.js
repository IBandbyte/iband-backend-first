import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

const SERVICE = "fan-power";
const PHASE = "H16";
const VERSION = 1;

const DATA_DIR = "/var/data/iband/db";

const SHARES_FILE = path.join(DATA_DIR, "shares", "events", "shares.jsonl");
const PURCHASES_FILE = path.join(DATA_DIR, "purchases", "events", "purchases.jsonl");

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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

function addScore(map, fanId, points, artistId = null) {
  if (!fanId) return;

  if (!map[fanId]) {
    map[fanId] = {
      fanId,
      totalScore: 0,
      shares: 0,
      purchases: 0,
      artists: {}
    };
  }

  map[fanId].totalScore += safeNum(points);

  if (artistId) {
    if (!map[fanId].artists[artistId]) {
      map[fanId].artists[artistId] = {
        artistId,
        score: 0,
        shares: 0,
        purchases: 0
      };
    }

    map[fanId].artists[artistId].score += safeNum(points);
  }
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
Global Fan Power Index
*/
router.get("/global", (req, res) => {
  try {
    const shareEvents = readJSONL(SHARES_FILE);
    const purchaseEvents = readJSONL(PURCHASES_FILE);

    const scores = {};

    for (const ev of shareEvents) {
      if (!ev?.fanId) continue;

      addScore(scores, ev.fanId, 6, ev.artistId || null);

      scores[ev.fanId].shares += 1;

      if (ev.artistId && scores[ev.fanId].artists[ev.artistId]) {
        scores[ev.fanId].artists[ev.artistId].shares += 1;
      }
    }

    for (const ev of purchaseEvents) {
      if (!ev?.fanId) continue;

      addScore(scores, ev.fanId, 10, ev.artistId || null);

      scores[ev.fanId].purchases += 1;

      if (ev.artistId && scores[ev.fanId].artists[ev.artistId]) {
        scores[ev.fanId].artists[ev.artistId].purchases += 1;
      }
    }

    const list = Object.values(scores)
      .map((fan) => ({
        fanId: fan.fanId,
        fanPowerScore: fan.totalScore,
        shares: fan.shares,
        purchases: fan.purchases,
        artistCount: Object.keys(fan.artists).length
      }))
      .sort((a, b) => b.fanPowerScore - a.fanPowerScore);

    res.json({
      success: true,
      list: list.slice(0, 50),
      fansRanked: list.length,
      ts: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "fan_power_global_failed",
      message: err.message
    });
  }
});

/*
Artist-specific Fan Power
*/
router.get("/artist/:artistId", (req, res) => {
  try {
    const { artistId } = req.params;

    const shareEvents = readJSONL(SHARES_FILE);
    const purchaseEvents = readJSONL(PURCHASES_FILE);

    const scores = {};

    for (const ev of shareEvents) {
      if (!ev?.fanId) continue;
      if (ev.artistId !== artistId) continue;

      if (!scores[ev.fanId]) {
        scores[ev.fanId] = {
          fanId: ev.fanId,
          fanPowerScore: 0,
          shares: 0,
          purchases: 0
        };
      }

      scores[ev.fanId].fanPowerScore += 6;
      scores[ev.fanId].shares += 1;
    }

    for (const ev of purchaseEvents) {
      if (!ev?.fanId) continue;
      if (ev.artistId !== artistId) continue;

      if (!scores[ev.fanId]) {
        scores[ev.fanId] = {
          fanId: ev.fanId,
          fanPowerScore: 0,
          shares: 0,
          purchases: 0
        };
      }

      scores[ev.fanId].fanPowerScore += 10;
      scores[ev.fanId].purchases += 1;
    }

    const list = Object.values(scores).sort(
      (a, b) => b.fanPowerScore - a.fanPowerScore
    );

    res.json({
      success: true,
      artistId,
      list: list.slice(0, 50),
      fansRanked: list.length,
      ts: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "fan_power_artist_failed",
      message: err.message
    });
  }
});

export default router;