import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H37 Global Live Activity Feed
|--------------------------------------------------------------------------
| Creates a real-time global activity stream using votes, discovery,
| radar signals, breakout alerts, viral stream items, and regional spikes.
|--------------------------------------------------------------------------
*/

const ACTIVITY_FEED = [
  {
    id: "activity_001",
    type: "fan_vote",
    country: "Brazil",
    artist: "Demo Artist Brazil",
    icon: "👍",
    priority: "medium",
    source: "votes",
    title: "52 fans voted for Demo Artist Brazil",
    message: "Fan voting activity is rising quickly in Brazil."
  },
  {
    id: "activity_002",
    type: "radar_signal",
    country: "Japan",
    artist: "Demo Artist Japan",
    icon: "📡",
    priority: "high",
    source: "global-radar",
    title: "Radar signal detected in Japan",
    message: "Regional discovery velocity is increasing."
  },
  {
    id: "activity_003",
    type: "breakout_alert",
    country: "Nigeria",
    artist: "Demo Artist Nigeria",
    icon: "💥",
    priority: "critical",
    source: "breakout-alerts",
    title: "Breakout alert triggered in Nigeria",
    message: "This track is entering breakout territory."
  },
  {
    id: "activity_004",
    type: "discovery_event",
    country: "Greece",
    artist: "Demo Artist Greece",
    icon: "💎",
    priority: "medium",
    source: "live-events",
    title: "Fans are discovering a hidden gem in Greece",
    message: "Discovery activity is building around a new artist."
  },
  {
    id: "activity_005",
    type: "share_spike",
    country: "Argentina",
    artist: "Demo Artist Argentina",
    icon: "🔁",
    priority: "high",
    source: "shares",
    title: "Song shared 80 times in Argentina",
    message: "Cross-border sharing is helping the song spread."
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getPriorityItems() {
  return ACTIVITY_FEED.filter(
    (item) => item.priority === "high" || item.priority === "critical"
  );
}

function getRandomActivity() {
  const index = Math.floor(Math.random() * ACTIVITY_FEED.length);
  return {
    ...ACTIVITY_FEED[index],
    generatedAt: new Date().toISOString()
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/activity-feed
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "H37 Global Live Activity Feed live.",
    count: ACTIVITY_FEED.length,
    routes: [
      "/api/activity-feed",
      "/api/activity-feed/list",
      "/api/activity-feed/priority",
      "/api/activity-feed/random"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/activity-feed/list
|--------------------------------------------------------------------------
*/

router.get("/list", (req, res) => {
  return res.json({
    success: true,
    count: ACTIVITY_FEED.length,
    activities: ACTIVITY_FEED
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/activity-feed/priority
|--------------------------------------------------------------------------
*/

router.get("/priority", (req, res) => {
  const items = getPriorityItems();

  return res.json({
    success: true,
    count: items.length,
    activities: items
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/activity-feed/random
|--------------------------------------------------------------------------
*/

router.get("/random", (req, res) => {
  const activity = getRandomActivity();

  return res.json({
    success: true,
    activity
  });
});

export default router;