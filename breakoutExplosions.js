import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H32 Breakout Explosion Engine
|--------------------------------------------------------------------------
| Detects multi-country viral breakout events and creates explosion
| objects for the map, feed, artist dashboards, and scout views.
|--------------------------------------------------------------------------
*/

const BREAKOUT_EXPLOSIONS = [
  {
    id: "explosion_001",
    artist: "Demo Artist Nigeria",
    countries: ["Nigeria", "Brazil", "Spain"],
    breakoutScore: 94,
    momentum: "Extreme",
    triggerSignals: [
      "breakoutProbability",
      "momentumPulse",
      "heatMap",
      "breakoutAlerts"
    ],
    mapEffect: "shockwave",
    feedPriority: "critical",
    icon: "💥",
    message: "Global breakout explosion detected across multiple countries."
  },
  {
    id: "explosion_002",
    artist: "Demo Artist Brazil",
    countries: ["Brazil", "Argentina", "Mexico"],
    breakoutScore: 89,
    momentum: "High",
    triggerSignals: [
      "breakoutProbability",
      "heatMap",
      "globalFeed"
    ],
    mapEffect: "shockwave",
    feedPriority: "high",
    icon: "🚀",
    message: "Cross-border breakout event detected in Latin regions."
  },
  {
    id: "explosion_003",
    artist: "Demo Artist Japan",
    countries: ["Japan", "South Korea"],
    breakoutScore: 78,
    momentum: "Rising",
    triggerSignals: [
      "momentumPulse",
      "hiddenGems"
    ],
    mapEffect: "pulse",
    feedPriority: "medium",
    icon: "⚡",
    message: "Regional breakout event forming in East Asia."
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getCriticalExplosions() {
  return BREAKOUT_EXPLOSIONS.filter(
    (item) => item.feedPriority === "critical" || item.breakoutScore >= 90
  );
}

function getRandomExplosion() {
  const index = Math.floor(Math.random() * BREAKOUT_EXPLOSIONS.length);
  return {
    ...BREAKOUT_EXPLOSIONS[index],
    generatedAt: new Date().toISOString()
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/breakout-explosions
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "H32 Breakout Explosion Engine live.",
    count: BREAKOUT_EXPLOSIONS.length,
    routes: [
      "/api/breakout-explosions",
      "/api/breakout-explosions/list",
      "/api/breakout-explosions/critical",
      "/api/breakout-explosions/random"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/breakout-explosions/list
|--------------------------------------------------------------------------
*/

router.get("/list", (req, res) => {
  return res.json({
    success: true,
    count: BREAKOUT_EXPLOSIONS.length,
    explosions: BREAKOUT_EXPLOSIONS
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/breakout-explosions/critical
|--------------------------------------------------------------------------
*/

router.get("/critical", (req, res) => {
  const critical = getCriticalExplosions();

  return res.json({
    success: true,
    count: critical.length,
    explosions: critical
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/breakout-explosions/random
|--------------------------------------------------------------------------
*/

router.get("/random", (req, res) => {
  const explosion = getRandomExplosion();

  return res.json({
    success: true,
    explosion
  });
});

export default router;