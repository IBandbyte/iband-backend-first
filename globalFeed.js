import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H27 Global Discovery Feed
|--------------------------------------------------------------------------
| Live discovery stream combining gems, countries, warp jumps, trends,
| and explorer progress moments.
|--------------------------------------------------------------------------
*/

const FEED_ITEMS = [
  {
    id: "feed_001",
    type: "hidden_gem",
    icon: "💎",
    title: "Hidden gem found in Greece",
    description: "A new hidden gem has been discovered in the Greece feed.",
    region: "Greece",
    reward: {
      xp: 50,
      label: "Hidden Gem Discovery"
    }
  },
  {
    id: "feed_002",
    type: "country_discovery",
    icon: "🌎",
    title: "New country discovery in Brazil",
    description: "Fans are exploring Brazil and unlocking new cultural instruments.",
    region: "Brazil",
    reward: {
      xp: 40,
      label: "Country Discovery"
    }
  },
  {
    id: "feed_003",
    type: "warp_drive",
    icon: "🚀",
    title: "Warp Drive jump triggered",
    description: "Discovery traffic has jumped from Argentina to Spain.",
    region: "Argentina → Spain",
    reward: {
      xp: 60,
      label: "Warp Jump"
    }
  },
  {
    id: "feed_004",
    type: "trend_signal",
    icon: "🔥",
    title: "Trending region activated",
    description: "Nigeria is heating up with fresh artist discovery signals.",
    region: "Nigeria",
    reward: {
      xp: 35,
      label: "Trend Signal"
    }
  },
  {
    id: "feed_005",
    type: "explorer_progress",
    icon: "🧭",
    title: "Explorer milestone reached",
    description: "A fan has advanced closer to Sound Explorer rank.",
    region: "Global",
    reward: {
      xp: 45,
      label: "Explorer Progress"
    }
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getRandomFeedItem() {
  const index = Math.floor(Math.random() * FEED_ITEMS.length);
  return {
    ...FEED_ITEMS[index],
    generatedAt: new Date().toISOString()
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/global-feed
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "H27 Global Discovery Feed live.",
    count: FEED_ITEMS.length,
    routes: [
      "/api/global-feed",
      "/api/global-feed/list",
      "/api/global-feed/random"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/global-feed/list
|--------------------------------------------------------------------------
*/

router.get("/list", (req, res) => {
  return res.json({
    success: true,
    count: FEED_ITEMS.length,
    items: FEED_ITEMS
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/global-feed/random
|--------------------------------------------------------------------------
*/

router.get("/random", (req, res) => {
  const item = getRandomFeedItem();

  return res.json({
    success: true,
    item
  });
});

export default router;