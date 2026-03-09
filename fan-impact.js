import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

const SERVICE = "fan-impact";
const PHASE = "H15";
const VERSION = 1;

const DATA_DIR = "/var/data/iband/db";

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function readJSON(file) {
  try {
    if (!fs.existsSync(file)) return [];
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (Array.isArray(raw)) return raw;
    return [];
  } catch {
    return [];
  }
}

/*
Health check
*/
router.get("/health", (req, res) => {

  res.json({
    success: true,
    service: SERVICE,
    phase: PHASE,
    version: VERSION,
    ts: new Date().toISOString()
  });

});

/*
Fan impact leaderboard
*/
router.get("/artist/:artistId", (req, res) => {

  try {

    const artistId = req.params.artistId;

    const sharesFile = path.join(DATA_DIR, "shares/shares.json");
    const purchasesFile = path.join(DATA_DIR, "purchases/purchases.json");

    const shares = readJSON(sharesFile);
    const purchases = readJSON(purchasesFile);

    const impact = {};

    for (const s of shares) {

      if (s.artistId !== artistId) continue;

      const fan = s.fanId;

      impact[fan] = (impact[fan] || 0) + 6;

    }

    for (const p of purchases) {

      if (p.artistId !== artistId) continue;

      const fan = p.fanId;

      impact[fan] = (impact[fan] || 0) + 10;

    }

    const results = Object.entries(impact).map(([fanId, score]) => ({
      fanId,
      impactScore: score
    }));

    results.sort((a, b) => b.impactScore - a.impactScore);

    res.json({
      success: true,
      artistId,
      list: results.slice(0, 20),
      ts: new Date().toISOString()
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      error: "fan_impact_failed",
      message: err.message
    });

  }

});

export default router;