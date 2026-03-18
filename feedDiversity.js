import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H47 Feed Diversity Engine
|--------------------------------------------------------------------------
| Balances feed composition across breakout artists, viral picks,
| hidden gems, regional discoveries, and genre spread.
|--------------------------------------------------------------------------
*/

const DIVERSITY_MIX = [
  {
    slot: 1,
    category: "breakout_artist",
    artist: "Demo Artist Nigeria",
    country: "Nigeria",
    genre: "Afrobeats",
    diversityReason: "Ensures breakout momentum is represented early in feed.",
    icon: "🚀",
    weight: 30
  },
  {
    slot: 2,
    category: "viral_pick",
    artist: "Demo Artist Brazil",
    country: "Brazil",
    genre: "Funk / Pop",
    diversityReason: "Balances breakout content with viral energy.",
    icon: "🔥",
    weight: 25
  },
  {
    slot: 3,
    category: "regional_discovery",
    artist: "Demo Artist Japan",
    country: "Japan",
    genre: "J-Pop",
    diversityReason: "Introduces regional discovery beyond dominant geographies.",
    icon: "📡",
    weight: 20
  },
  {
    slot: 4,
    category: "hidden_gem",
    artist: "Demo Artist Greece",
    country: "Greece",
    genre: "Pop / Indie",
    diversityReason: "Prevents feed from ignoring early hidden gem opportunities.",
    icon: "💎",
    weight: 15
  },
  {
    slot: 5,
    category: "genre_expansion",
    artist: "Demo Artist Argentina",
    country: "Argentina",
    genre: "Latin Pop",
    diversityReason: "Adds genre spread so the feed stays fresh and varied.",
    icon: "🌎",
    weight: 10
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getHighWeightMix() {
  return DIVERSITY_MIX.filter((item) => item.weight >= 20);
}

function getRandomMixItem() {
  const index = Math.floor(Math.random() * DIVERSITY_MIX.length);
  return {
    ...DIVERSITY_MIX[index],
    generatedAt: new Date().toISOString()
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/feed-diversity
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "H47 Feed Diversity Engine live.",
    count: DIVERSITY_MIX.length,
    routes: [
      "/api/feed-diversity",
      "/api/feed-diversity/list",
      "/api/feed-diversity/high-weight",
      "/api/feed-diversity/random"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/feed-diversity/list
|--------------------------------------------------------------------------
*/

router.get("/list", (req, res) => {
  return res.json({
    success: true,
    count: DIVERSITY_MIX.length,
    mix: DIVERSITY_MIX
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/feed-diversity/high-weight
|--------------------------------------------------------------------------
*/

router.get("/high-weight", (req, res) => {
  const mix = getHighWeightMix();

  return res.json({
    success: true,
    count: mix.length,
    mix
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/feed-diversity/random
|--------------------------------------------------------------------------
*/

router.get("/random", (req, res) => {
  return res.json({
    success: true,
    item: getRandomMixItem()
  });
});

export default router;