import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H45 Smart Feed Engine
|--------------------------------------------------------------------------
| Converts discovery-brain decisions into homepage-ready smart feed cards.
|--------------------------------------------------------------------------
*/

const SMART_FEED_ITEMS = [
  {
    id: "feed_card_001",
    type: "breakout_push",
    artist: "Demo Artist Nigeria",
    country: "Nigeria",
    priority: "critical",
    cardTitle: "Breakout artist you should hear now",
    cardSubtitle: "Massive breakout momentum detected",
    feedReason: "Top discovery brain decision",
    action: "play_now",
    icon: "🚀",
    message: "This artist is showing strong global breakout signals."
  },
  {
    id: "feed_card_002",
    type: "viral_pick",
    artist: "Demo Artist Brazil",
    country: "Brazil",
    priority: "high",
    cardTitle: "Viral momentum rising fast",
    cardSubtitle: "Fan energy and reach are accelerating",
    feedReason: "High momentum + high fan energy",
    action: "discover_artist",
    icon: "🔥",
    message: "This artist is heating up across multiple discovery surfaces."
  },
  {
    id: "feed_card_003",
    type: "regional_watch",
    artist: "Demo Artist Japan",
    country: "Japan",
    priority: "medium",
    cardTitle: "Regional trend building",
    cardSubtitle: "Watch this artist before the breakout",
    feedReason: "Radar and momentum signals increasing",
    action: "watch_now",
    icon: "📡",
    message: "This artist is gaining regional traction and may expand further."
  },
  {
    id: "feed_card_004",
    type: "hidden_gem",
    artist: "Demo Artist Greece",
    country: "Greece",
    priority: "medium",
    cardTitle: "Hidden gem worth discovering",
    cardSubtitle: "Early signals suggest strong upside",
    feedReason: "Hidden gem growth pattern",
    action: "discover_hidden_gem",
    icon: "💎",
    message: "A promising artist with early discovery momentum."
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getPriorityCards() {
  return SMART_FEED_ITEMS.filter(
    (item) => item.priority === "critical" || item.priority === "high"
  );
}

function getRandomCard() {
  const index = Math.floor(Math.random() * SMART_FEED_ITEMS.length);
  return {
    ...SMART_FEED_ITEMS[index],
    generatedAt: new Date().toISOString()
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/smart-feed
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "H45 Smart Feed Engine live.",
    count: SMART_FEED_ITEMS.length,
    routes: [
      "/api/smart-feed",
      "/api/smart-feed/list",
      "/api/smart-feed/priority",
      "/api/smart-feed/random"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/smart-feed/list
|--------------------------------------------------------------------------
*/

router.get("/list", (req, res) => {
  return res.json({
    success: true,
    count: SMART_FEED_ITEMS.length,
    feed: SMART_FEED_ITEMS
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/smart-feed/priority
|--------------------------------------------------------------------------
*/

router.get("/priority", (req, res) => {
  const feed = getPriorityCards();

  return res.json({
    success: true,
    count: feed.length,
    feed
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/smart-feed/random
|--------------------------------------------------------------------------
*/

router.get("/random", (req, res) => {
  return res.json({
    success: true,
    item: getRandomCard()
  });
});

export default router;