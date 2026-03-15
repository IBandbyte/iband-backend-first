import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H29 Global Heat Map Engine
|--------------------------------------------------------------------------
| Converts momentum scores into heat colors and map states.
|--------------------------------------------------------------------------
*/

const COUNTRY_HEAT = [
  {
    country: "Brazil",
    code: "BR",
    momentumScore: 87
  },
  {
    country: "Nigeria",
    code: "NG",
    momentumScore: 92
  },
  {
    country: "Argentina",
    code: "AR",
    momentumScore: 75
  },
  {
    country: "Japan",
    code: "JP",
    momentumScore: 68
  },
  {
    country: "Greece",
    code: "GR",
    momentumScore: 54
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getHeatState(score) {
  if (score >= 96) {
    return {
      color: "gold",
      label: "Breakout Explosion",
      icon: "💥"
    };
  }

  if (score >= 86) {
    return {
      color: "red",
      label: "Viral",
      icon: "🔥"
    };
  }

  if (score >= 76) {
    return {
      color: "magenta",
      label: "Trending",
      icon: "🚀"
    };
  }

  if (score >= 61) {
    return {
      color: "yellow",
      label: "Rising",
      icon: "⚡"
    };
  }

  if (score >= 41) {
    return {
      color: "emerald",
      label: "Hidden Gem",
      icon: "💎"
    };
  }

  return {
    color: "blue",
    label: "Quiet",
    icon: "🌊"
  };
}

function buildHeatMap() {
  return COUNTRY_HEAT.map((item) => ({
    ...item,
    heat: getHeatState(item.momentumScore)
  }));
}

function getRandomHeat() {
  const mapped = buildHeatMap();
  const index = Math.floor(Math.random() * mapped.length);
  return {
    ...mapped[index],
    generatedAt: new Date().toISOString()
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/heat-map
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "H29 Global Heat Map Engine live.",
    count: COUNTRY_HEAT.length,
    routes: [
      "/api/heat-map",
      "/api/heat-map/list",
      "/api/heat-map/random"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/heat-map/list
|--------------------------------------------------------------------------
*/

router.get("/list", (req, res) => {
  const heatMap = buildHeatMap();

  return res.json({
    success: true,
    count: heatMap.length,
    countries: heatMap
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/heat-map/random
|--------------------------------------------------------------------------
*/

router.get("/random", (req, res) => {
  const country = getRandomHeat();

  return res.json({
    success: true,
    country
  });
});

export default router;