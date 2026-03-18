import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H41 Global Heatmap Engine
|--------------------------------------------------------------------------
| Converts discovery signals into visual heat layers for map rendering.
|--------------------------------------------------------------------------
*/

const HEAT_POINTS = [
  {
    id: "heat_001",
    country: "Nigeria",
    code: "NG",
    lat: 9.082,
    lng: 8.6753,
    heatScore: 95,
    level: "breakout",
    color: "gold",
    label: "Breakout Explosion",
    message: "Massive breakout activity detected."
  },
  {
    id: "heat_002",
    country: "Brazil",
    code: "BR",
    lat: -14.235,
    lng: -51.9253,
    heatScore: 88,
    level: "viral",
    color: "red",
    label: "Viral",
    message: "High viral spread across regions."
  },
  {
    id: "heat_003",
    country: "Japan",
    code: "JP",
    lat: 36.2048,
    lng: 138.2529,
    heatScore: 72,
    level: "trending",
    color: "magenta",
    label: "Trending",
    message: "Momentum is increasing rapidly."
  },
  {
    id: "heat_004",
    country: "Greece",
    code: "GR",
    lat: 39.0742,
    lng: 21.8243,
    heatScore: 55,
    level: "rising",
    color: "yellow",
    label: "Rising",
    message: "Discovery activity is building."
  },
  {
    id: "heat_005",
    country: "Norway",
    code: "NO",
    lat: 60.472,
    lng: 8.4689,
    heatScore: 25,
    level: "quiet",
    color: "blue",
    label: "Quiet",
    message: "Low activity region."
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getHotZones() {
  return HEAT_POINTS.filter(p => p.heatScore >= 70);
}

function getRandomPoint() {
  const i = Math.floor(Math.random() * HEAT_POINTS.length);
  return {
    ...HEAT_POINTS[i],
    generatedAt: new Date().toISOString()
  };
}

/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "H41 Global Heatmap Engine live.",
    count: HEAT_POINTS.length,
    routes: [
      "/api/global-heatmap",
      "/api/global-heatmap/list",
      "/api/global-heatmap/hot",
      "/api/global-heatmap/random"
    ]
  });
});

router.get("/list", (req, res) => {
  return res.json({
    success: true,
    count: HEAT_POINTS.length,
    points: HEAT_POINTS
  });
});

router.get("/hot", (req, res) => {
  const hot = getHotZones();

  return res.json({
    success: true,
    count: hot.length,
    points: hot
  });
});

router.get("/random", (req, res) => {
  return res.json({
    success: true,
    point: getRandomPoint()
  });
});

export default router;