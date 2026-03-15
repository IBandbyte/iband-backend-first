import express from "express";
import { getTopBreakouts, getArtistBreakout } from "./breakoutEngine.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H18 Live Event Heat System
|--------------------------------------------------------------------------
| Purpose:
| - provide live-event heat data for the Global Music Map
| - expose heat zones, pulse intensity and hotspot metadata
| - support future livestream map overlays and live activity prompts
|--------------------------------------------------------------------------
*/

const HEAT_RULES = [
  {
    level: "quiet",
    minScore: 0,
    heatColor: "blue",
    heatStrength: "none",
    hotspot: false,
    icon: "❄️",
    label: "Quiet"
  },
  {
    level: "warmup",
    minScore: 10,
    heatColor: "emerald",
    heatStrength: "low",
    hotspot: false,
    icon: "💎",
    label: "Warmup"
  },
  {
    level: "heating_up",
    minScore: 50,
    heatColor: "yellow",
    heatStrength: "low",
    hotspot: true,
    icon: "🌱",
    label: "Heating Up"
  },
  {
    level: "hot_live",
    minScore: 150,
    heatColor: "magenta",
    heatStrength: "medium",
    hotspot: true,
    icon: "🔥",
    label: "Hot Live"
  },
  {
    level: "viral_live",
    minScore: 400,
    heatColor: "red",
    heatStrength: "high",
    hotspot: true,
    icon: "🚀",
    label: "Viral Live"
  },
  {
    level: "explosion_live",
    minScore: 800,
    heatColor: "gold",
    heatStrength: "max",
    hotspot: true,
    icon: "💥",
    label: "Explosion Live"
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getHeatRule(score) {
  let selected = HEAT_RULES[0];

  for (const rule of HEAT_RULES) {
    if (score >= rule.minScore) {
      selected = rule;
    }
  }

  return selected;
}

function buildHeatResult(artistId) {
  const breakout = getArtistBreakout(artistId);
  const rule = getHeatRule(breakout.score);

  return {
    artistId: breakout.artistId,
    score: breakout.score,
    breakoutStage: breakout.stage,
    liveHeat: {
      level: rule.level,
      heatColor: rule.heatColor,
      heatStrength: rule.heatStrength,
      hotspot: rule.hotspot,
      icon: rule.icon,
      label: rule.label
    },
    heatVisual: {
      pulse:
        rule.heatStrength !== "none",
      zoneOpacity:
        rule.heatStrength === "max"
          ? 1
          : rule.heatStrength === "high"
            ? 0.8
            : rule.heatStrength === "medium"
              ? 0.6
              : rule.heatStrength === "low"
                ? 0.4
                : 0.2,
      radarRingCount:
        rule.heatStrength === "max"
          ? 4
          : rule.heatStrength === "high"
            ? 3
            : rule.heatStrength === "medium"
              ? 2
              : rule.heatStrength === "low"
                ? 1
                : 0
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
  const explosionZones = top.filter((artist) => artist.score >= 800).length;

  return res.json({
    success: true,
    message: "H18 Live Event Heat System live.",
    trackedArtists: top.length,
    hotspotCount: hotspots,
    explosionZones,
    stages: HEAT_RULES,
    routes: [
      "/api/live-heat",
      "/api/live-heat/top",
      "/api/live-heat/:artistId"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Top heat zones
|--------------------------------------------------------------------------
*/
router.get("/top", (req, res) => {
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 10;

  const artists = getTopBreakouts(limit).map((artist) =>
    buildHeatResult(artist.artistId)
  );

  return res.json({
    success: true,
    count: artists.length,
    artists
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Single artist heat state
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

  const result = buildHeatResult(artistId);

  return res.json({
    success: true,
    ...result
  });
});

export default router;