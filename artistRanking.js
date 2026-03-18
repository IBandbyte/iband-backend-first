import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H43 Artist Ranking Intelligence Engine
|--------------------------------------------------------------------------
| Ranks artists using momentum, fan energy, growth rate,
| breakout probability, and global reach.
|--------------------------------------------------------------------------
*/

const ARTIST_RANKINGS = [
  {
    rank: 1,
    artist: "Demo Artist Nigeria",
    country: "Nigeria",
    genre: "Afrobeats",
    momentumScore: 90,
    fanEnergy: 88,
    growthRate: 28,
    breakoutProbability: 94,
    globalReach: 85,
    rankingScore: 91,
    badge: "Breakout Leader",
    icon: "🥇",
    message: "Top-ranked artist based on combined breakout and momentum signals."
  },
  {
    rank: 2,
    artist: "Demo Artist Brazil",
    country: "Brazil",
    genre: "Funk / Pop",
    momentumScore: 88,
    fanEnergy: 92,
    growthRate: 24,
    breakoutProbability: 89,
    globalReach: 83,
    rankingScore: 89,
    badge: "Momentum Star",
    icon: "🥈",
    message: "Strong fan energy and momentum performance."
  },
  {
    rank: 3,
    artist: "Demo Artist Japan",
    country: "Japan",
    genre: "J-Pop",
    momentumScore: 64,
    fanEnergy: 54,
    growthRate: 15,
    breakoutProbability: 71,
    globalReach: 62,
    rankingScore: 66,
    badge: "Regional Rising",
    icon: "🥉",
    message: "Growing steadily with strong regional discovery signals."
  },
  {
    rank: 4,
    artist: "Demo Artist Greece",
    country: "Greece",
    genre: "Pop / Indie",
    momentumScore: 64,
    fanEnergy: 61,
    growthRate: 12,
    breakoutProbability: 63,
    globalReach: 55,
    rankingScore: 63,
    badge: "Hidden Gem Watch",
    icon: "💎",
    message: "Promising early-stage artist with hidden gem potential."
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getTopRanked() {
  return ARTIST_RANKINGS.filter((artist) => artist.rankingScore >= 85);
}

function getRandomRankedArtist() {
  const index = Math.floor(Math.random() * ARTIST_RANKINGS.length);
  return {
    ...ARTIST_RANKINGS[index],
    generatedAt: new Date().toISOString()
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/artist-ranking
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "H43 Artist Ranking Intelligence Engine live.",
    count: ARTIST_RANKINGS.length,
    routes: [
      "/api/artist-ranking",
      "/api/artist-ranking/list",
      "/api/artist-ranking/top",
      "/api/artist-ranking/random"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/artist-ranking/list
|--------------------------------------------------------------------------
*/

router.get("/list", (req, res) => {
  return res.json({
    success: true,
    count: ARTIST_RANKINGS.length,
    rankings: ARTIST_RANKINGS
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/artist-ranking/top
|--------------------------------------------------------------------------
*/

router.get("/top", (req, res) => {
  const rankings = getTopRanked();

  return res.json({
    success: true,
    count: rankings.length,
    rankings
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/artist-ranking/random
|--------------------------------------------------------------------------
*/

router.get("/random", (req, res) => {
  return res.json({
    success: true,
    ranking: getRandomRankedArtist()
  });
});

export default router;