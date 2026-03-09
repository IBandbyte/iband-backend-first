// fan-impact.js
// Phase H15 — Fan Impact Engine
// Calculates which fans have the biggest influence on an artist's growth.

import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

const SHARES_FILE = "/var/data/iband/db/shares/events/shares.jsonl";

function safeReadLines(file) {
  try {
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, "utf8");
    if (!raw) return [];
    return raw.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

router.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "fan-impact",
    phase: "H15",
    version: 1,
    ts: new Date().toISOString()
  });
});

router.get("/artist/:artistId", (req, res) => {
  try {
    const { artistId } = req.params;

    const lines = safeReadLines(SHARES_FILE);

    const scores = {};

    for (const line of lines) {
      let event;

      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }

      if (event.artistId !== artistId) continue;

      // IMPORTANT FIX
      if (!event.fanId) continue;

      const fanId = event.fanId;

      if (!scores[fanId]) scores[fanId] = 0;

      // share weight
      scores[fanId] += 6;
    }

    const list = Object.entries(scores)
      .map(([fanId, impactScore]) => ({
        fanId,
        impactScore
      }))
      .sort((a, b) => b.impactScore - a.impactScore);

    res.json({
      success: true,
      artistId,
      list,
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