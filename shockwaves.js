import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H33 Global Shockwave Engine
|--------------------------------------------------------------------------
| Transforms breakout explosion events into map-visible shockwave objects
| for the iBand global music map and live pulse visuals.
|--------------------------------------------------------------------------
*/

const SHOCKWAVES = [
  {
    id: "shockwave_001",
    artist: "Demo Artist Nigeria",
    originCountry: "Nigeria",
    affectedCountries: ["Nigeria", "Brazil", "Spain"],
    intensity: "extreme",
    radiusLevel: 5,
    animation: "shockwave",
    color: "gold",
    icon: "💥",
    triggerSource: "breakout-explosions",
    message: "Global shockwave spreading from Nigeria across multiple regions."
  },
  {
    id: "shockwave_002",
    artist: "Demo Artist Brazil",
    originCountry: "Brazil",
    affectedCountries: ["Brazil", "Argentina", "Mexico"],
    intensity: "high",
    radiusLevel: 4,
    animation: "shockwave",
    color: "red",
    icon: "🚀",
    triggerSource: "breakout-explosions",
    message: "Latin breakout shockwave expanding across connected countries."
  },
  {
    id: "shockwave_003",
    artist: "Demo Artist Japan",
    originCountry: "Japan",
    affectedCountries: ["Japan", "South Korea"],
    intensity: "medium",
    radiusLevel: 3,
    animation: "pulse",
    color: "magenta",
    icon: "⚡",
    triggerSource: "momentum-pulse",
    message: "Regional pulse detected across East Asia."
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getCriticalShockwaves() {
  return SHOCKWAVES.filter(
    (item) => item.intensity === "extreme" || item.radiusLevel >= 5
  );
}

function getRandomShockwave() {
  const index = Math.floor(Math.random() * SHOCKWAVES.length);
  return {
    ...SHOCKWAVES[index],
    generatedAt: new Date().toISOString()
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/shockwaves
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "H33 Global Shockwave Engine live.",
    count: SHOCKWAVES.length,
    routes: [
      "/api/shockwaves",
      "/api/shockwaves/list",
      "/api/shockwaves/critical",
      "/api/shockwaves/random"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/shockwaves/list
|--------------------------------------------------------------------------
*/

router.get("/list", (req, res) => {
  return res.json({
    success: true,
    count: SHOCKWAVES.length,
    shockwaves: SHOCKWAVES
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/shockwaves/critical
|--------------------------------------------------------------------------
*/

router.get("/critical", (req, res) => {
  const critical = getCriticalShockwaves();

  return res.json({
    success: true,
    count: critical.length,
    shockwaves: critical
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/shockwaves/random
|--------------------------------------------------------------------------
*/

router.get("/random", (req, res) => {
  const shockwave = getRandomShockwave();

  return res.json({
    success: true,
    shockwave
  });
});

export default router;