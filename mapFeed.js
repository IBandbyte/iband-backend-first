import express from "express";
import { getTopBreakouts, getArtistBreakout } from "./breakoutEngine.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H16 Global Music Map Feed
|--------------------------------------------------------------------------
| Purpose:
| - provide frontend-ready discovery feed data
| - expose map-oriented feed items for the future Global Music Map UI
| - combine breakout score + map-style presentation
|--------------------------------------------------------------------------
*/

const FEED_STAGE_RULES = [
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

function getFeedStage(score) {
  let selected = FEED_STAGE_RULES[0];

  for (const rule of FEED_STAGE_RULES) {
    if (score >= rule.minScore) {
      selected = rule;
    }
  }

  return selected;
}

function buildFeedItem(artistId) {
  const breakout = getArtistBreakout(artistId);
  const stage = getFeedStage(breakout.score);

  return {
    artistId: breakout.artistId,
    score: breakout.score,
    stage: {
      level: stage.level,
      color: stage.color,
      icon: stage.icon,
      label: stage.label
    },
    feedCard: {
      headline:
        stage.level === "breakout_explosion"
          ? "💥 Breakout Explosion"
          : stage.level === "viral"
            ? "🚀 Going Viral"
            : stage.level === "trending"
              ? "🔥 Trending Now"
              : stage.level === "rising"
                ? "🌱 Rising Fast"
                : stage.level === "hidden_gem"
                  ? "💎 Hidden Gem"
                  : "❄️ Quiet Discovery",
      subline: `${stage.label} signal on the Global Music Map`,
      mapColor: stage.color
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

  return res.json({
    success: true,
    message: "H16 Global Music Map Feed live.",
    trackedArtists: top.length,
    stages: FEED_STAGE_RULES,
    routes: [
      "/api/map-feed",
      "/api/map-feed/top",
      "/api/map-feed/:artistId"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Top feed items
|--------------------------------------------------------------------------
*/
router.get("/top", (req, res) => {
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 10;

  const items = getTopBreakouts(limit).map((artist) =>
    buildFeedItem(artist.artistId)
  );

  return res.json({
    success: true,
    count: items.length,
    items
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Single feed item
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

  const item = buildFeedItem(artistId);

  return res.json({
    success: true,
    ...item
  });
});

export default router;