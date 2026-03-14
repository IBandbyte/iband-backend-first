import express from "express";
import { getTopBreakouts, getArtistBreakout } from "./breakoutEngine.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H15 Global Music Radar System
|--------------------------------------------------------------------------
| Purpose:
| - provide radar-style frontend signals
| - show hotspot strength
| - expose spread / pulse intensity
| - support map radar UI later
|--------------------------------------------------------------------------
*/

const RADAR_RULES = [
  {
    level: "quiet",
    minScore: 0,
    pulseColor: "blue",
    pulseStrength: "none",
    hotspot: false,
    icon: "❄️",
    label: "Quiet"
  },
  {
    level: "hidden_gem",
    minScore: 10,
    pulseColor: "emerald",
    pulseStrength: "low",
    hotspot: false,
    icon: "💎",
    label: "Hidden Gem"
  },
  {
    level: "rising",
    minScore: 50,
    pulseColor: "yellow",
    pulseStrength: "low",
    hotspot: true,
    icon: "🌱",
    label: "Rising"
  },
  {
    level: "trending",
    minScore: 150,
    pulseColor: "magenta",
    pulseStrength: "medium",
    hotspot: true,
    icon: "🔥",
    label: "Trending"
  },
  {
    level: "viral",
    minScore: 400,
    pulseColor: "red",
    pulseStrength: "high",
    hotspot: true,
    icon: "🚀",
    label: "Viral"
  },
  {
    level: "breakout_explosion",
    minScore: 800,
    pulseColor: "gold",
    pulseStrength: "max",
    hotspot: true,
    icon: "💥",
    label: "Breakout Explosion"
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getRadarStage(score) {
  let selected = RADAR_RULES[0];

  for (const rule of RADAR_RULES) {
    if (score >= rule.minScore) {
      selected = rule;
    }
  }

  return selected;
}

function buildRadarResult(artistId) {
  const breakout = getArtistBreakout(artistId);
  const radarStage = getRadarStage(breakout.score);

  return {
    artistId: breakout.artistId,
    score: breakout.score,
    breakoutStage: breakout.stage,
    radar: {
      level: radarStage.level,
      pulseColor: radarStage.pulseColor,
      pulseStrength: radarStage.pulseStrength,
      hotspot: radarStage.hotspot,
      icon: radarStage.icon,
      label: radarStage.label
    },
    radarVisual: {
      ringCount:
        radarStage.pulseStrength === "max"
          ? 4
          : radarStage.pulseStrength === "high"
            ? 3
            : radarStage.pulseStrength === "medium"
              ? 2
              : radarStage.pulseStrength === "low"
                ? 1
                : 0,
      animated: radarStage.pulseStrength !== "none",
      heatLevel:
        radarStage.level === "breakout_explosion"
          ? "extreme"
          : radarStage.level === "viral"
            ? "high"
            : radarStage.level === "trending"
              ? "medium"
              : radarStage.level === "rising" || radarStage.level === "hidden_gem"
                ? "low"
                : "none"
    }
  };
}

/*
|--------------------------------------------------------------------------
| GET
| Root summary
|--------------------------------------------------------------------------
*/
router.get("/", (req, res) => {
  const top = getTopBreakouts(50);
  const hotspots = top.filter((artist) => artist.score >= 50).length;
  const explosions = top.filter((artist) => artist.score >= 800).length;

  return res.json({
    success: true,
    message: "H15 Global Music Radar System live.",
    trackedArtists: top.length,
    hotspotCount: hotspots,
    explosionHotspots: explosions,
    stages: RADAR_RULES,
    routes: [
      "/api/radar",
      "/api/radar/top",
      "/api/radar/:artistId"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Top radar candidates
|--------------------------------------------------------------------------
*/
router.get("/top", (req, res) => {
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 10;

  const topArtists = getTopBreakouts(limit).map((artist) =>
    buildRadarResult(artist.artistId)
  );

  return res.json({
    success: true,
    count: topArtists.length,
    artists: topArtists
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Single artist radar result
|--------------------------------------------------------------------------
*/
router.get("/:artistId", (req, res) => {
  const artistId = String(req.params.artistId || "").trim();

  if (!artistId) {
    return res.status(400).json({
      success: false,
      message: "artistId is required"
    });
  }

  const result = buildRadarResult(artistId);

  return res.json({
    success: true,
    ...result
  });
});

export default router;