import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H34 Global Radar Engine
|--------------------------------------------------------------------------
| Creates radar ping objects for live discovery signals, spread velocity,
| and real-time global music activity markers across the iBand map.
|--------------------------------------------------------------------------
*/

const RADAR_SIGNALS = [
  {
    id: "radar_001",
    artist: "Demo Artist Nigeria",
    country: "Nigeria",
    spreadVelocity: "extreme",
    signalStrength: 96,
    radarType: "viral_ping",
    color: "gold",
    icon: "📡",
    source: "breakout-explosions",
    message: "Extreme radar ping detected from Nigeria with cross-border spread."
  },
  {
    id: "radar_002",
    artist: "Demo Artist Brazil",
    country: "Brazil",
    spreadVelocity: "high",
    signalStrength: 88,
    radarType: "momentum_ping",
    color: "red",
    icon: "🚀",
    source: "momentum-pulse",
    message: "High spread velocity detected in Brazil."
  },
  {
    id: "radar_003",
    artist: "Demo Artist Japan",
    country: "Japan",
    spreadVelocity: "medium",
    signalStrength: 74,
    radarType: "regional_ping",
    color: "magenta",
    icon: "⚡",
    source: "heat-map",
    message: "Regional radar activity rising across East Asia."
  },
  {
    id: "radar_004",
    artist: "Demo Artist Greece",
    country: "Greece",
    spreadVelocity: "low",
    signalStrength: 58,
    radarType: "discovery_ping",
    color: "emerald",
    icon: "💎",
    source: "hidden-gems",
    message: "Discovery radar ping triggered by hidden gem activity."
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getStrongSignals() {
  return RADAR_SIGNALS.filter((item) => item.signalStrength >= 85);
}

function getRandomSignal() {
  const index = Math.floor(Math.random() * RADAR_SIGNALS.length);
  return {
    ...RADAR_SIGNALS[index],
    generatedAt: new Date().toISOString()
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/global-radar
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "H34 Global Radar Engine live.",
    count: RADAR_SIGNALS.length,
    routes: [
      "/api/global-radar",
      "/api/global-radar/list",
      "/api/global-radar/strong",
      "/api/global-radar/random"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/global-radar/list
|--------------------------------------------------------------------------
*/

router.get("/list", (req, res) => {
  return res.json({
    success: true,
    count: RADAR_SIGNALS.length,
    signals: RADAR_SIGNALS
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/global-radar/strong
|--------------------------------------------------------------------------
*/

router.get("/strong", (req, res) => {
  const strong = getStrongSignals();

  return res.json({
    success: true,
    count: strong.length,
    signals: strong
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/global-radar/random
|--------------------------------------------------------------------------
*/

router.get("/random", (req, res) => {
  const signal = getRandomSignal();

  return res.json({
    success: true,
    signal
  });
});

export default router;