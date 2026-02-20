// recs.js
// iBand Backend — Recs Mix (v6.4 Self-Contained Medal Engine)
// Root-level router: mounted at /api/recs
//
// Step 6.4:
// - Remove medals.js dependency entirely
// - Compute medal tiers internally
// - Fully self-contained (no ESM risk)
//
// Captain’s Protocol: full canonical, future-proof, Render-safe, always JSON.

import fs from "fs";
import path from "path";
import express from "express";

const router = express.Router();

const SERVICE = "recs-mix";
const VERSION = 28;

const DATA_DIR = process.env.IBAND_DATA_DIR || "/var/data/iband/db";
const EVENTS_AGG = path.join(DATA_DIR, "events-agg.json");
const ARTISTS_FILE = path.join(DATA_DIR, "artists.json");

// Medal tier thresholds (percentile-based)
const MEDAL_CONFIG = {
  goldTopPct: 0.05,
  silverTopPct: 0.2,
  bronzeTopPct: 0.5,
};

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function readJsonIfExists(p) {
  try {
    if (!fs.existsSync(p)) return null;
    return safeJsonParse(fs.readFileSync(p, "utf8"), null);
  } catch {
    return null;
  }
}

function extractArtists(parsed) {
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed;
  if (parsed.artists && Array.isArray(parsed.artists)) return parsed.artists;
  return Object.values(parsed).filter((x) => x && typeof x === "object");
}

function calculateScore(life = {}) {
  return (
    (life.views || 0) * 1 +
    (life.replays || 0) * 2.5 +
    (life.likes || 0) * 1.5 +
    (life.saves || 0) * 3.5 +
    (life.shares || 0) * 4.5 +
    (life.follows || 0) * 5 +
    (life.comments || 0) * 2 +
    (life.votes || 0) * 1 +
    (life.watchMs || 0) / 10000
  );
}

function assignMedals(scoredList) {
  const total = scoredList.length;

  return scoredList.map((item, index) => {
    const pct = total ? index / total : 1;
    let medal = null;

    if (pct <= MEDAL_CONFIG.goldTopPct) {
      medal = { tier: "gold", label: "Gold", emoji: "🥇", hex: "#D4AF37" };
    } else if (pct <= MEDAL_CONFIG.silverTopPct) {
      medal = { tier: "silver", label: "Silver", emoji: "🥈", hex: "#C0C0C0" };
    } else if (pct <= MEDAL_CONFIG.bronzeTopPct) {
      medal = { tier: "bronze", label: "Bronze", emoji: "🥉", hex: "#CD7F32" };
    } else {
      medal = { tier: "certified", label: "Certified", emoji: "🎸", hex: "#6C63FF" };
    }

    return { ...item, medal };
  });
}

// Health
router.get("/health", (_req, res) => {
  const artists = extractArtists(readJsonIfExists(ARTISTS_FILE) || []);
  res.json({
    success: true,
    service: SERVICE,
    version: VERSION,
    updatedAt: nowIso(),
    artistsLoaded: artists.length,
  });
});

// Feed
router.get("/mix", (req, res) => {
  const sessionId = String(req.query.sessionId || "").trim() || "anon";

  const artistsRaw = readJsonIfExists(ARTISTS_FILE);
  const aggRaw = readJsonIfExists(EVENTS_AGG);

  const artists = extractArtists(artistsRaw);
  const aggArtists = aggRaw?.artists || {};

  const scored = artists.map((a) => {
    const life = aggArtists[a.id]?.lifetime || {};
    const score = calculateScore(life);

    return {
      artist: {
        id: a.id,
        name: a.name,
        imageUrl: a.imageUrl || null,
        genre: a.genre || null,
        location: a.location || null,
      },
      score,
      metrics: life,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const withMedals = assignMedals(scored);

  return res.json({
    success: true,
    version: VERSION,
    updatedAt: nowIso(),
    sessionId,
    count: withMedals.length,
    results: withMedals.map((x) => ({
      artist: { ...x.artist, medal: x.medal },
      score: Number(x.score.toFixed(6)),
      metrics: x.metrics,
      source: "ranked",
    })),
  });
});

export default router;