import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Temporary in-memory activity store
|--------------------------------------------------------------------------
| Later this will connect to database / analytics pipeline
*/
const activitySignals = [];

/*
|--------------------------------------------------------------------------
| Helper: determine map stage from score
|--------------------------------------------------------------------------
*/
function getStage(score) {

  if (score >= 800) {
    return {
      level: "breakout",
      color: "gold",
      icon: "💥"
    };
  }

  if (score >= 400) {
    return {
      level: "viral",
      color: "red",
      icon: "🚀"
    };
  }

  if (score >= 150) {
    return {
      level: "trending",
      color: "magenta",
      icon: "🔥"
    };
  }

  if (score >= 50) {
    return {
      level: "rising",
      color: "yellow",
      icon: "🌱"
    };
  }

  if (score >= 10) {
    return {
      level: "hidden-gem",
      color: "emerald",
      icon: "💎"
    };
  }

  return {
    level: "quiet",
    color: "blue",
    icon: "❄️"
  };
}

/*
|--------------------------------------------------------------------------
| GET
| Root summary
|--------------------------------------------------------------------------
*/
router.get("/", (req, res) => {

  return res.json({
    success: true,
    message: "H10 Map Activity Engine live.",
    signalsTracked: activitySignals.length,
    routes: [
      "/api/map-activity",
      "/api/map-activity/signals",
      "/api/map-activity/record",
      "/api/map-activity/countries",
      "/api/map-activity/stage/:country"
    ]
  });

});

/*
|--------------------------------------------------------------------------
| POST
| Record activity signal
|--------------------------------------------------------------------------
*/
router.post("/record", (req, res) => {

  const {
    artistId,
    country,
    type,
    value
  } = req.body;

  if (!artistId || !country) {
    return res.status(400).json({
      success: false,
      message: "artistId and country required"
    });
  }

  const signal = {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    artistId,
    country,
    type: type || "play",
    value: value || 1,
    createdAt: new Date().toISOString()
  };

  activitySignals.push(signal);

  return res.json({
    success: true,
    message: "Map activity recorded",
    signal
  });

});

/*
|--------------------------------------------------------------------------
| GET
| All signals
|--------------------------------------------------------------------------
*/
router.get("/signals", (req, res) => {

  return res.json({
    success: true,
    count: activitySignals.length,
    signals: activitySignals
  });

});

/*
|--------------------------------------------------------------------------
| GET
| Country momentum summary
|--------------------------------------------------------------------------
*/
router.get("/countries", (req, res) => {

  const countryScores = {};

  activitySignals.forEach(signal => {

    if (!countryScores[signal.country]) {
      countryScores[signal.country] = 0;
    }

    countryScores[signal.country] += signal.value;

  });

  const results = Object.entries(countryScores).map(([country, score]) => {

    const stage = getStage(score);

    return {
      country,
      score,
      stage: stage.level,
      color: stage.color,
      icon: stage.icon
    };

  });

  return res.json({
    success: true,
    count: results.length,
    countries: results
  });

});

/*
|--------------------------------------------------------------------------
| GET
| Stage for specific country
|--------------------------------------------------------------------------
*/
router.get("/stage/:country", (req, res) => {

  const country = String(req.params.country || "").trim();

  const score = activitySignals
    .filter(s => s.country === country)
    .reduce((sum, s) => sum + s.value, 0);

  const stage = getStage(score);

  return res.json({
    success: true,
    country,
    score,
    stage
  });

});

export default router;