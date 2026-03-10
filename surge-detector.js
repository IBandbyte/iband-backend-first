import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

const SERVICE = "surge-detector";
const PHASE = "H19";
const VERSION = 1;

const DATA_DIR = "/var/data/iband/db";

const SHARES_FILE = path.join(DATA_DIR, "shares", "events", "shares.jsonl");
const PURCHASES_FILE = path.join(DATA_DIR, "purchases", "events", "purchases.jsonl");

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
Detect surge activity
*/
router.get("/artists", (req, res) => {
  try {
    const shareEvents = readJSONL(SHARES_FILE);
    const purchaseEvents = readJSONL(PURCHASES_FILE);

    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    const surge = {};

    function add(artistId, weight) {
      if (!artistId) return;

      if (!surge[artistId]) {
        surge[artistId] = {
          artistId,
          shareSignals: 0,
          purchaseSignals: 0,
          surgeScore: 0
        };
      }

      surge[artistId].surgeScore += weight;
    }

    for (const ev of shareEvents) {
      const ts = safeTs(ev.ts);
      if (!ts) continue;

      if (now - ts <= oneHour) {
        add(ev.artistId, 6);
        surge[ev.artistId].shareSignals += 1;
      }
    }

    for (const ev of purchaseEvents) {
      const ts = safeTs(ev.ts);
      if (!ts) continue;

      if (now - ts <= oneHour) {
        add(ev.artistId, 10);
        surge[ev.artistId].purchaseSignals += 1;
      }
    }

    const list = Object.values(surge)
      .sort((a, b) => b.surgeScore - a.surgeScore)
      .map((row, index) => ({
        rank: index + 1,
        ...row
      }));

    res.json({
      success: true,
      window: "1h",
      list,
      artistsDetected: list.length,
      ts: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "surge_detection_failed",
      message: err.message
    });
  }
});

export default router;