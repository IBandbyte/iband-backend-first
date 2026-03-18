import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H44 Global Discovery Brain
|--------------------------------------------------------------------------
| Central decision engine that combines artist ranking, momentum,
| fan energy, heatmap, viral stream, and breakout signals into
| discovery recommendations.
|--------------------------------------------------------------------------
*/

const DISCOVERY_DECISIONS = [
  {
    id: "brain_001",
    artist: "Demo Artist Nigeria",
    country: "Nigeria",
    priority: "critical",
    decisionScore: 94,
    action: "boost_globally",
    momentumScore: 90,
    fanEnergy: 88,
    breakoutProbability: 94,
    heatLevel: "breakout",
    viralState: "active",
    rankingScore: 91,
    icon: "🚀",
    reason: "Global breakout + high fan energy + top ranking alignment.",
    message: "Push this artist into global discovery immediately."
  },
  {
    id: "brain_002",
    artist: "Demo Artist Brazil",
    country: "Brazil",
    priority: "high",
    decisionScore: 89,
    action: "boost_regionally",
    momentumScore: 88,
    fanEnergy: 92,
    breakoutProbability: 89,
    heatLevel: "viral",
    viralState: "active",
    rankingScore: 89,
    icon: "🔥",
    reason: "High momentum and fan energy with strong regional virality.",
    message: "Prioritize this artist across Latin and adjacent markets."
  },
  {
    id: "brain_003",
    artist: "Demo Artist Japan",
    country: "Japan",
    priority: "medium",
    decisionScore: 68,
    action: "watch_and_expand",
    momentumScore: 64,
    fanEnergy: 54,
    breakoutProbability: 71,
    heatLevel: "trending",
    viralState: "building",
    rankingScore: 66,
    icon: "📡",
    reason: "Regional trend building with moderate expansion potential.",
    message: "Monitor and test broader discovery placement."
  },
  {
    id: "brain_004",
    artist: "Demo Artist Greece",
    country: "Greece",
    priority: "medium",
    decisionScore: 65,
    action: "protect_hidden_gem",
    momentumScore: 64,
    fanEnergy: 61,
    breakoutProbability: 63,
    heatLevel: "rising",
    viralState: "early",
    rankingScore: 63,
    icon: "💎",
    reason: "Hidden gem growth with early discovery support.",
    message: "Keep this artist visible in hidden gem and rising surfaces."
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getPriorityDecisions() {
  return DISCOVERY_DECISIONS.filter(
    (item) => item.priority === "critical" || item.priority === "high"
  );
}

function getRandomDecision() {
  const index = Math.floor(Math.random() * DISCOVERY_DECISIONS.length);
  return {
    ...DISCOVERY_DECISIONS[index],
    generatedAt: new Date().toISOString()
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/discovery-brain
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "H44 Global Discovery Brain live.",
    count: DISCOVERY_DECISIONS.length,
    routes: [
      "/api/discovery-brain",
      "/api/discovery-brain/list",
      "/api/discovery-brain/priority",
      "/api/discovery-brain/random"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/discovery-brain/list
|--------------------------------------------------------------------------
*/

router.get("/list", (req, res) => {
  return res.json({
    success: true,
    count: DISCOVERY_DECISIONS.length,
    decisions: DISCOVERY_DECISIONS
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/discovery-brain/priority
|--------------------------------------------------------------------------
*/

router.get("/priority", (req, res) => {
  const decisions = getPriorityDecisions();

  return res.json({
    success: true,
    count: decisions.length,
    decisions
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/discovery-brain/random
|--------------------------------------------------------------------------
*/

router.get("/random", (req, res) => {
  return res.json({
    success: true,
    decision: getRandomDecision()
  });
});

export default router;