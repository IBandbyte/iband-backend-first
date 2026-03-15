import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H30 Breakout Probability Engine
|--------------------------------------------------------------------------
| Estimates the probability of an artist going viral based on
| combined discovery signals.
|--------------------------------------------------------------------------
*/

const ARTIST_BREAKOUT_DATA = [
  {
    artist: "Demo Artist Brazil",
    country: "Brazil",
    votes: 420,
    shares: 180,
    fanPower: 88,
    momentum: 87,
    heatColor: "red",
    hiddenGems: 4
  },
  {
    artist: "Demo Artist Nigeria",
    country: "Nigeria",
    votes: 510,
    shares: 230,
    fanPower: 94,
    momentum: 92,
    heatColor: "red",
    hiddenGems: 5
  },
  {
    artist: "Demo Artist Argentina",
    country: "Argentina",
    votes: 290,
    shares: 120,
    fanPower: 72,
    momentum: 75,
    heatColor: "yellow",
    hiddenGems: 2
  },
  {
    artist: "Demo Artist Japan",
    country: "Japan",
    votes: 250,
    shares: 100,
    fanPower: 69,
    momentum: 68,
    heatColor: "yellow",
    hiddenGems: 2
  },
  {
    artist: "Demo Artist Greece",
    country: "Greece",
    votes: 170,
    shares: 80,
    fanPower: 54,
    momentum: 54,
    heatColor: "emerald",
    hiddenGems: 1
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function calculateBreakoutScore(item) {
  const voteScore = item.votes * 0.15;
  const shareScore = item.shares * 0.2;
  const fanPowerScore = item.fanPower * 1.5;
  const momentumScore = item.momentum * 1.7;
  const gemScore = item.hiddenGems * 10;

  const rawScore =
    voteScore + shareScore + fanPowerScore + momentumScore + gemScore;

  return Math.min(100, Math.round(rawScore / 10));
}

function getStatus(score) {
  if (score >= 90) {
    return {
      label: "Breakout Imminent",
      confidence: "High",
      icon: "💥"
    };
  }

  if (score >= 75) {
    return {
      label: "Strong Breakout Potential",
      confidence: "High",
      icon: "🚀"
    };
  }

  if (score >= 55) {
    return {
      label: "Emerging",
      confidence: "Medium",
      icon: "⚡"
    };
  }

  return {
    label: "Developing",
    confidence: "Low",
    icon: "🌱"
  };
}

function buildProbabilities() {
  return ARTIST_BREAKOUT_DATA.map((item) => {
    const breakoutScore = calculateBreakoutScore(item);
    const status = getStatus(breakoutScore);

    return {
      ...item,
      breakoutScore,
      status
    };
  });
}

function getRandomProbability() {
  const items = buildProbabilities();
  const index = Math.floor(Math.random() * items.length);
  return {
    ...items[index],
    generatedAt: new Date().toISOString()
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/breakout-probability
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "H30 Breakout Probability Engine live.",
    count: ARTIST_BREAKOUT_DATA.length,
    routes: [
      "/api/breakout-probability",
      "/api/breakout-probability/list",
      "/api/breakout-probability/random"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/breakout-probability/list
|--------------------------------------------------------------------------
*/

router.get("/list", (req, res) => {
  const items = buildProbabilities();

  return res.json({
    success: true,
    count: items.length,
    artists: items
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/breakout-probability/random
|--------------------------------------------------------------------------
*/

router.get("/random", (req, res) => {
  const item = getRandomProbability();

  return res.json({
    success: true,
    artist: item
  });
});

export default router;