import express from "express";
import { getTopBreakouts, getArtistBreakout } from "./breakoutEngine.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H14 Global Breakout Map Intelligence Engine
|--------------------------------------------------------------------------
| Purpose:
| - provide frontend-ready map intelligence
| - convert breakout scores into map stages
| - expose top breakout/explosion candidates
| - provide country-style visual metadata for future world map UI
|--------------------------------------------------------------------------
*/

const MAP_STAGE_RULES = [
  {
    level: "quiet",
    minScore: 0,
    color: "blue",
    icon: "❄️",
    label: "Quiet"
  },
  {
    level: "hidden_gem",
    minScore: 10,
    color: "emerald",
    icon: "💎",
    label: "Hidden Gem"
  },
  {
    level: "rising",
    minScore: 50,
    color: "yellow",
    icon: "🌱",
    label: "Rising"
  },
  {
    level: "trending",
    minScore: 150,
    color: "magenta",
    icon: "🔥",
    label: "Trending"
  },
  {
    level: "viral",
    minScore: 400,
    color: "red",
    icon: "🚀",
    label: "Viral"
  },
  {
    level: "breakout_explosion",
    minScore: 800,
    color: "gold",
    icon: "💥",
    label: "Breakout Explosion"
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getMapStage(score) {
  let selected = MAP_STAGE_RULES[0];

  for (const rule of MAP_STAGE_RULES) {
    if (score >= rule.minScore) {
      selected = rule;
    }
  }

  return selected;
}

function buildArtistMapIntelligence(artistId) {
  const breakout = getArtistBreakout(artistId);
  const mapStage = getMapStage(breakout.score);

  return {
    artistId: breakout.artistId,
    score: breakout.score,
    breakoutStage: breakout.stage,
    mapStage: {
      level: mapStage.level,
      color: mapStage.color,
      icon: mapStage.icon,
      label: mapStage.label
    },
    mapVisual: {
      glow: mapStage.color,
      pulse: mapStage.level !== "quiet",
      radarStrength:
        mapStage.level === "breakout_explosion"
          ? "max"
          : mapStage.level === "viral"
            ? "high"
            : mapStage.level === "trending"
              ? "medium"
              : mapStage.level === "rising" || mapStage.level === "hidden_gem"
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
  const explosionCount = top.filter((artist) => artist.score >= 800).length;

  return res.json({
    success: true,
    message: "H14 Global Breakout Map Intelligence Engine live.",
    trackedArtists: top.length,
    explosionsDetected: explosionCount,
    stages: MAP_STAGE_RULES,
    routes: [
      "/api/map-intelligence",
      "/api/map-intelligence/top",
      "/api/map-intelligence/:artistId"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Top map intelligence candidates
|--------------------------------------------------------------------------
*/
router.get("/top", (req, res) => {
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 10;

  const topArtists = getTopBreakouts(limit).map((artist) =>
    buildArtistMapIntelligence(artist.artistId)
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
| Single artist map intelligence
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

  const intelligence = buildArtistMapIntelligence(artistId);

  return res.json({
    success: true,
    ...intelligence
  });
});

export default router;