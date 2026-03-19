import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H50 Predictive Feed Engine
|--------------------------------------------------------------------------
| Predicts what content should appear next based on behavioural
| patterns, likely drop-off risk, novelty need, and breakout timing.
|--------------------------------------------------------------------------
*/

const PREDICTIVE_FEED_SIGNALS = [
  {
    id: "predict_001",
    userMode: "locked_in_breakout",
    predictedNextAction: "show_high_momentum_artist",
    confidence: 92,
    dropOffRisk: 18,
    noveltyNeed: 24,
    injectionTiming: "now",
    recommendedArtist: "Demo Artist Nigeria",
    recommendedCategory: "breakout_push",
    icon: "🚀",
    reason: "User is highly engaged and likely to respond well to another breakout artist."
  },
  {
    id: "predict_002",
    userMode: "warming_up_curious",
    predictedNextAction: "show_viral_pick",
    confidence: 84,
    dropOffRisk: 28,
    noveltyNeed: 41,
    injectionTiming: "soon",
    recommendedArtist: "Demo Artist Brazil",
    recommendedCategory: "viral_pick",
    icon: "🔥",
    reason: "User is warming up and may engage more strongly with high-energy viral content."
  },
  {
    id: "predict_003",
    userMode: "regional_focus",
    predictedNextAction: "show_adjacent_region_artist",
    confidence: 76,
    dropOffRisk: 34,
    noveltyNeed: 46,
    injectionTiming: "soon",
    recommendedArtist: "Demo Artist Japan",
    recommendedCategory: "regional_discovery",
    icon: "📡",
    reason: "User behaviour suggests appetite for regionally relevant but slightly broader discovery."
  },
  {
    id: "predict_004",
    userMode: "bored_needs_novelty",
    predictedNextAction: "inject_hidden_gem",
    confidence: 81,
    dropOffRisk: 67,
    noveltyNeed: 88,
    injectionTiming: "immediate",
    recommendedArtist: "Demo Artist Greece",
    recommendedCategory: "hidden_gem",
    icon: "💎",
    reason: "Drop-off risk is rising, so novelty should be injected immediately."
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getHighConfidencePredictions() {
  return PREDICTIVE_FEED_SIGNALS.filter((item) => item.confidence >= 85);
}

function getRandomPrediction() {
  const index = Math.floor(Math.random() * PREDICTIVE_FEED_SIGNALS.length);
  return {
    ...PREDICTIVE_FEED_SIGNALS[index],
    generatedAt: new Date().toISOString()
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/predictive-feed
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "H50 Predictive Feed Engine live.",
    count: PREDICTIVE_FEED_SIGNALS.length,
    routes: [
      "/api/predictive-feed",
      "/api/predictive-feed/list",
      "/api/predictive-feed/high-confidence",
      "/api/predictive-feed/random"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/predictive-feed/list
|--------------------------------------------------------------------------
*/

router.get("/list", (req, res) => {
  return res.json({
    success: true,
    count: PREDICTIVE_FEED_SIGNALS.length,
    predictions: PREDICTIVE_FEED_SIGNALS
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/predictive-feed/high-confidence
|--------------------------------------------------------------------------
*/

router.get("/high-confidence", (req, res) => {
  const predictions = getHighConfidencePredictions();

  return res.json({
    success: true,
    count: predictions.length,
    predictions
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/predictive-feed/random
|--------------------------------------------------------------------------
*/

router.get("/random", (req, res) => {
  return res.json({
    success: true,
    prediction: getRandomPrediction()
  });
});

export default router;