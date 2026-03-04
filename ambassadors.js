/**
 * ambassadors.js
 * ---------------------------------------
 * Phase H5 – Ambassador Qualification Engine
 *
 * Determines if a fan qualifies as an Ambassador
 * for a specific artist based on:
 *
 * - trend_starter
 * - conversion_starter
 * - podium ranking
 *
 * Data sources:
 * /var/data/iband/db/shares/events/shares.jsonl
 * /var/data/iband/db/monetisation/events/monetisation-signals.jsonl
 *
 * This service does NOT mutate data.
 * It evaluates status.
 */

import express from "express";
import fs from "fs/promises";
import path from "path";

const router = express.Router();

const DATA_DIR = process.env.IBAND_DATA_DIR || "/var/data/iband/db";

const SHARES_FILE = path.join(
  DATA_DIR,
  "shares",
  "events",
  "shares.jsonl"
);

const MON_FILE = path.join(
  DATA_DIR,
  "monetisation",
  "events",
  "monetisation-signals.jsonl"
);

const LIMITS = {
  maxReadBytes: 20 * 1024 * 1024,
  maxLineScan: 180000
};

function safeJson(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

async function readJsonl(file) {
  try {
    const raw = await fs.readFile(file, "utf8");
    return raw.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function withinLookback(ts, days = 120) {
  const t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return false;

  const diff = Date.now() - t;
  return diff <= days * 86400000;
}

router.get("/health", async (req, res) => {
  return res.json({
    success: true,
    service: "ambassadors",
    phase: "H5",
    storage: DATA_DIR,
    ts: new Date().toISOString()
  });
});

router.get("/artist/:artistId/fan/:fanId", async (req, res) => {

  const artistId = (req.params.artistId || "").trim();
  const fanId = (req.params.fanId || "").trim();

  if (!artistId || !fanId) {
    return res.status(400).json({
      success: false,
      error: "missing_params"
    });
  }

  const shareLines = await readJsonl(SHARES_FILE);
  const monLines = await readJsonl(MON_FILE);

  let shareCount = 0;
  let purchaseCount = 0;

  let firstShareTs = null;
  let firstConversionTs = null;

  for (let i = 0; i < shareLines.length; i++) {

    const evt = safeJson(shareLines[i]);
    if (!evt) continue;

    if (evt.artistId !== artistId) continue;
    if (evt.referrerFanId !== fanId) continue;
    if (!withinLookback(evt.ts)) continue;

    shareCount++;

    const t = new Date(evt.ts).getTime();
    if (!firstShareTs || t < firstShareTs) {
      firstShareTs = t;
    }
  }

  for (let i = 0; i < monLines.length; i++) {

    const evt = safeJson(monLines[i]);
    if (!evt) continue;

    if (evt.artistId !== artistId) continue;
    if (!evt.ref) continue;
    if (!withinLookback(evt.ts)) continue;

    purchaseCount++;

    const t = new Date(evt.ts).getTime();
    if (!firstConversionTs || t < firstConversionTs) {
      firstConversionTs = t;
    }
  }

  const badges = [];

  if (shareCount >= 1) {
    badges.push("trend_starter");
  }

  if (purchaseCount >= 1) {
    badges.push("conversion_starter");
  }

  let tier = "none";

  if (badges.includes("conversion_starter")) {
    tier = "gold";
  } else if (badges.includes("trend_starter")) {
    tier = "silver";
  }

  const ambassador = tier !== "none";

  return res.json({
    success: true,
    artistId,
    fanId,
    ambassador,
    tier,
    shareCount,
    purchaseCount,
    badges,
    updatedAt: new Date().toISOString()
  });

});

export default router;