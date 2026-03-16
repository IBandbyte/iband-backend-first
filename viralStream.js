import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H36 Viral Stream Engine
|--------------------------------------------------------------------------
| Creates the live flowing discovery stream for the homepage using
| breakout alerts, explosions, shockwaves, radar signals, and live events.
|--------------------------------------------------------------------------
*/

const VIRAL_STREAM_ITEMS = [
  {
    id: "stream_001",
    type: "breakout_explosion",
    title: "Global breakout explosion detected",
    subtitle: "Nigeria → Brazil → Spain",
    artist: "Demo Artist Nigeria",
    country: "Nigeria",
    priority: "critical",
    icon: "💥",
    source: "breakout-explosions",
    cta: "Tap to discover",
    message: "A song is exploding across multiple countries right now."
  },
  {
    id: "stream_002",
    type: "momentum_surge",
    title: "Momentum surge in Brazil",
    subtitle: "Discovery velocity is accelerating fast",
    artist: "Demo Artist Brazil",
    country: "Brazil",
    priority: "high",
    icon: "🚀",
    source: "momentum-pulse",
    cta: "See why it's rising",
    message: "Fans are rapidly pushing this track into wider discovery."
  },
  {
    id: "stream_003",
    type: "radar_ping",
    title: "Radar signal detected in Japan",
    subtitle: "Regional spread is building",
    artist: "Demo Artist Japan",
    country: "Japan",
    priority: "medium",
    icon: "📡",
    source: "global-radar",
    cta: "Open radar",
    message: "A growing regional discovery pattern has been detected."
  },
  {
    id: "stream_004",
    type: "shockwave_event",
    title: "Shockwave moving through Latin America",
    subtitle: "Brazil → Argentina → Mexico",
    artist: "Demo Artist Brazil",
    country: "Brazil",
    priority: "high",
    icon: "🌍",
    source: "shockwaves",
    cta: "Track the wave",
    message: "A regional shockwave is moving across connected discovery zones."
  },
  {
    id: "stream_005",
    type: "live_discovery",
    title: "Something is happening in Greece",
    subtitle: "Hidden gem activity is rising",
    artist: "Demo Artist Greece",
    country: "Greece",
    priority: "medium",
    icon: "💎",
    source: "live-events",
    cta: "Tap to discover",
    message: "Fans are uncovering a new discovery signal right now."
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getCriticalItems() {
  return VIRAL_STREAM_ITEMS.filter(
    (item) => item.priority === "critical" || item.priority === "high"
  );
}

function getRandomItem() {
  const index = Math.floor(Math.random() * VIRAL_STREAM_ITEMS.length);
  return {
    ...VIRAL_STREAM_ITEMS[index],
    generatedAt: new Date().toISOString()
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/viral-stream
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "H36 Viral Stream Engine live.",
    count: VIRAL_STREAM_ITEMS.length,
    routes: [
      "/api/viral-stream",
      "/api/viral-stream/list",
      "/api/viral-stream/critical",
      "/api/viral-stream/random"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/viral-stream/list
|--------------------------------------------------------------------------
*/

router.get("/list", (req, res) => {
  return res.json({
    success: true,
    count: VIRAL_STREAM_ITEMS.length,
    stream: VIRAL_STREAM_ITEMS
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/viral-stream/critical
|--------------------------------------------------------------------------
*/

router.get("/critical", (req, res) => {
  const critical = getCriticalItems();

  return res.json({
    success: true,
    count: critical.length,
    stream: critical
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/viral-stream/random
|--------------------------------------------------------------------------
*/

router.get("/random", (req, res) => {
  const item = getRandomItem();

  return res.json({
    success: true,
    item
  });
});

export default router;