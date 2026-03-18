import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H48 Engagement Optimiser Engine
|--------------------------------------------------------------------------
| Optimises feed ordering using watch strength, replay value,
| skip resistance, save potential, and engagement lift.
|--------------------------------------------------------------------------
*/

const ENGAGEMENT_SIGNALS = [
  {
    id: "engage_001",
    artist: "Demo Artist Nigeria",
    country: "Nigeria",
    watchStrength: 94,
    replayValue: 88,
    skipResistance: 91,
    savePotential: 86,
    shareLift: 84,
    engagementScore: 91,
    action: "push_higher",
    icon: "🚀",
    message: "Strong all-round engagement signals. Increase feed priority."
  },
  {
    id: "engage_002",
    artist: "Demo Artist Brazil",
    country: "Brazil",
    watchStrength: 89,
    replayValue: 83,
    skipResistance: 85,
    savePotential: 80,
    shareLift: 87,
    engagementScore: 86,
    action: "maintain_high",
    icon: "🔥",
    message: "High engagement stability. Keep this artist highly visible."
  },
  {
    id: "engage_003",
    artist: "Demo Artist Japan",
    country: "Japan",
    watchStrength: 72,
    replayValue: 67,
    skipResistance: 70,
    savePotential: 64,
    shareLift: 61,
    engagementScore: 68,
    action: "test_expand",
    icon: "📡",
    message: "Moderate engagement. Expand carefully into adjacent surfaces."
  },
  {
    id: "engage_004",
    artist: "Demo Artist Greece",
    country: "Greece",
    watchStrength: 61,
    replayValue: 59,
    skipResistance: 66,
    savePotential: 62,
    shareLift: 58,
    engagementScore: 61,
    action: "protect_niche",
    icon: "💎",
    message: "Protect this niche artist in hidden gem and discovery slots."
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getStrongEngagement() {
  return ENGAGEMENT_SIGNALS.filter(
    (item) => item.engagementScore >= 85
  );
}

function getRandomEngagement() {
  const index = Math.floor(Math.random() * ENGAGEMENT_SIGNALS.length);
  return {
    ...ENGAGEMENT_SIGNALS[index],
    generatedAt: new Date().toISOString()
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/engagement-optimiser
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "H48 Engagement Optimiser Engine live.",
    count: ENGAGEMENT_SIGNALS.length,
    routes: [
      "/api/engagement-optimiser",
      "/api/engagement-optimiser/list",
      "/api/engagement-optimiser/strong",
      "/api/engagement-optimiser/random"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/engagement-optimiser/list
|--------------------------------------------------------------------------
*/

router.get("/list", (req, res) => {
  return res.json({
    success: true,
    count: ENGAGEMENT_SIGNALS.length,
    signals: ENGAGEMENT_SIGNALS
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/engagement-optimiser/strong
|--------------------------------------------------------------------------
*/

router.get("/strong", (req, res) => {
  const signals = getStrongEngagement();

  return res.json({
    success: true,
    count: signals.length,
    signals
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/engagement-optimiser/random
|--------------------------------------------------------------------------
*/

router.get("/random", (req, res) => {
  return res.json({
    success: true,
    signal: getRandomEngagement()
  });
});

export default router;