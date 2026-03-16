import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H35 Live Discovery Event Engine
|--------------------------------------------------------------------------
| Creates real-time discovery event objects triggered by radar signals,
| breakout explosions, shockwaves, and trending activity.
|--------------------------------------------------------------------------
*/

const LIVE_EVENTS = [
  {
    id: "live_event_001",
    type: "viral_event",
    title: "Viral event detected in Nigeria",
    subtitle: "Song spreading rapidly across multiple countries",
    country: "Nigeria",
    artist: "Demo Artist Nigeria",
    priority: "critical",
    icon: "💥",
    source: "breakout-explosions",
    cta: "Tap to discover",
    message: "A global breakout event is unfolding right now."
  },
  {
    id: "live_event_002",
    type: "momentum_event",
    title: "Momentum surge in Brazil",
    subtitle: "Discovery velocity is accelerating",
    country: "Brazil",
    artist: "Demo Artist Brazil",
    priority: "high",
    icon: "🚀",
    source: "momentum-pulse",
    cta: "See why it's rising",
    message: "Brazil is showing strong cross-border growth signals."
  },
  {
    id: "live_event_003",
    type: "radar_event",
    title: "Radar ping detected in Japan",
    subtitle: "Regional signal increasing across East Asia",
    country: "Japan",
    artist: "Demo Artist Japan",
    priority: "medium",
    icon: "📡",
    source: "global-radar",
    cta: "Open radar",
    message: "Live radar activity is pointing to a growing regional trend."
  },
  {
    id: "live_event_004",
    type: "discovery_event",
    title: "Something is happening in Greece",
    subtitle: "Hidden gem activity is rising",
    country: "Greece",
    artist: "Demo Artist Greece",
    priority: "medium",
    icon: "💎",
    source: "hidden-gems",
    cta: "Tap to discover",
    message: "Fans are uncovering a growing discovery signal."
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getCriticalEvents() {
  return LIVE_EVENTS.filter(
    (event) => event.priority === "critical" || event.priority === "high"
  );
}

function getRandomEvent() {
  const index = Math.floor(Math.random() * LIVE_EVENTS.length);
  return {
    ...LIVE_EVENTS[index],
    generatedAt: new Date().toISOString()
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/live-events
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "H35 Live Discovery Event Engine live.",
    count: LIVE_EVENTS.length,
    routes: [
      "/api/live-events",
      "/api/live-events/list",
      "/api/live-events/critical",
      "/api/live-events/random"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/live-events/list
|--------------------------------------------------------------------------
*/

router.get("/list", (req, res) => {
  return res.json({
    success: true,
    count: LIVE_EVENTS.length,
    events: LIVE_EVENTS
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/live-events/critical
|--------------------------------------------------------------------------
*/

router.get("/critical", (req, res) => {
  const critical = getCriticalEvents();

  return res.json({
    success: true,
    count: critical.length,
    events: critical
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/live-events/random
|--------------------------------------------------------------------------
*/

router.get("/random", (req, res) => {
  const event = getRandomEvent();

  return res.json({
    success: true,
    event
  });
});

export default router;