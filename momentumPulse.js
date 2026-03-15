import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H28 Global Momentum Pulse Engine
|--------------------------------------------------------------------------
| Calculates country momentum scores and emerging hotspots.
|--------------------------------------------------------------------------
*/

const COUNTRY_MOMENTUM = [
  {
    country: "Brazil",
    code: "BR",
    momentumScore: 87,
    status: "Trending",
    signals: ["votes", "shares", "fanPower"]
  },
  {
    country: "Nigeria",
    code: "NG",
    momentumScore: 92,
    status: "Hot",
    signals: ["shares", "comments", "fanPower", "hiddenGem"]
  },
  {
    country: "Argentina",
    code: "AR",
    momentumScore: 75,
    status: "Rising",
    signals: ["votes", "warpDrive", "artistDiscovery"]
  },
  {
    country: "Japan",
    code: "JP",
    momentumScore: 68,
    status: "Rising",
    signals: ["missions", "instrumentUnlocks"]
  },
  {
    country: "Greece",
    code: "GR",
    momentumScore: 54,
    status: "Emerging",
    signals: ["countryDiscovery", "comments"]
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getHotspots() {
  return COUNTRY_MOMENTUM.filter((item) => item.momentumScore >= 80);
}

function getRandomPulse() {
  const index = Math.floor(Math.random() * COUNTRY_MOMENTUM.length);
  return {
    ...COUNTRY_MOMENTUM[index],
    generatedAt: new Date().toISOString()
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/momentum-pulse
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "H28 Global Momentum Pulse Engine live.",
    count: COUNTRY_MOMENTUM.length,
    routes: [
      "/api/momentum-pulse",
      "/api/momentum-pulse/list",
      "/api/momentum-pulse/hotspots",
      "/api/momentum-pulse/random"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/momentum-pulse/list
|--------------------------------------------------------------------------
*/

router.get("/list", (req, res) => {
  return res.json({
    success: true,
    count: COUNTRY_MOMENTUM.length,
    countries: COUNTRY_MOMENTUM
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/momentum-pulse/hotspots
|--------------------------------------------------------------------------
*/

router.get("/hotspots", (req, res) => {
  const hotspots = getHotspots();

  return res.json({
    success: true,
    count: hotspots.length,
    hotspots
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/momentum-pulse/random
|--------------------------------------------------------------------------
*/

router.get("/random", (req, res) => {
  const pulse = getRandomPulse();

  return res.json({
    success: true,
    pulse
  });
});

export default router;