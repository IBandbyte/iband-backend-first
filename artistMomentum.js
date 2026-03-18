import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H42 Artist Momentum Profile Engine
|--------------------------------------------------------------------------
| Creates artist-level momentum profiles using growth, fan energy,
| breakout probability, reach, and momentum score signals.
|--------------------------------------------------------------------------
*/

const ARTIST_MOMENTUM_PROFILES = [
  {
    id: "artist_momentum_001",
    artist: "Demo Artist Nigeria",
    country: "Nigeria",
    genre: "Afrobeats",
    momentumScore: 90,
    growthRate: 28,
    fanEnergy: 88,
    breakoutProbability: 94,
    globalReach: 85,
    trendStatus: "Breakout Imminent",
    icon: "🚀",
    message: "Multiple signals indicate this artist is close to a major breakout."
  },
  {
    id: "artist_momentum_002",
    artist: "Demo Artist Brazil",
    country: "Brazil",
    genre: "Funk / Pop",
    momentumScore: 88,
    growthRate: 24,
    fanEnergy: 92,
    breakoutProbability: 89,
    globalReach: 83,
    trendStatus: "High Momentum",
    icon: "🔥",
    message: "Strong fan-driven growth and high discovery momentum."
  },
  {
    id: "artist_momentum_003",
    artist: "Demo Artist Japan",
    country: "Japan",
    genre: "J-Pop",
    momentumScore: 64,
    growthRate: 15,
    fanEnergy: 54,
    breakoutProbability: 71,
    globalReach: 62,
    trendStatus: "Rising Discovery",
    icon: "📡",
    message: "Regional discovery is building and audience reach is increasing."
  },
  {
    id: "artist_momentum_004",
    artist: "Demo Artist Greece",
    country: "Greece",
    genre: "Pop / Indie",
    momentumScore: 64,
    growthRate: 12,
    fanEnergy: 61,
    breakoutProbability: 63,
    globalReach: 55,
    trendStatus: "Hidden Gem Growth",
    icon: "💎",
    message: "Hidden gem signals suggest early-stage momentum growth."
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getTopProfiles() {
  return ARTIST_MOMENTUM_PROFILES.filter(
    (profile) => profile.momentumScore >= 85
  );
}

function getRandomProfile() {
  const index = Math.floor(Math.random() * ARTIST_MOMENTUM_PROFILES.length);
  return {
    ...ARTIST_MOMENTUM_PROFILES[index],
    generatedAt: new Date().toISOString()
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/artist-momentum
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "H42 Artist Momentum Profile Engine live.",
    count: ARTIST_MOMENTUM_PROFILES.length,
    routes: [
      "/api/artist-momentum",
      "/api/artist-momentum/list",
      "/api/artist-momentum/top",
      "/api/artist-momentum/random"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/artist-momentum/list
|--------------------------------------------------------------------------
*/

router.get("/list", (req, res) => {
  return res.json({
    success: true,
    count: ARTIST_MOMENTUM_PROFILES.length,
    profiles: ARTIST_MOMENTUM_PROFILES
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/artist-momentum/top
|--------------------------------------------------------------------------
*/

router.get("/top", (req, res) => {
  const profiles = getTopProfiles();

  return res.json({
    success: true,
    count: profiles.length,
    profiles
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/artist-momentum/random
|--------------------------------------------------------------------------
*/

router.get("/random", (req, res) => {
  return res.json({
    success: true,
    profile: getRandomProfile()
  });
});

export default router;