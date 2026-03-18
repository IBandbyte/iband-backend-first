import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H46 Feed Personalisation Engine
|--------------------------------------------------------------------------
| Creates user-specific feed output based on preferences, country,
| behaviour type, and engagement profile.
|--------------------------------------------------------------------------
*/

const PERSONALISED_FEEDS = [
  {
    profileId: "profile_001",
    persona: "afrobeats_explorer",
    country: "United Kingdom",
    favouriteGenres: ["Afrobeats", "Amapiano", "Pop"],
    behaviourType: "early_adopter",
    engagementLevel: "high",
    feed: [
      {
        id: "pfeed_001",
        artist: "Demo Artist Nigeria",
        reason: "Matches your genre taste and strong breakout momentum.",
        action: "play_now",
        icon: "🚀"
      },
      {
        id: "pfeed_002",
        artist: "Demo Artist Brazil",
        reason: "High fan energy and viral momentum outside your usual region.",
        action: "discover_artist",
        icon: "🔥"
      }
    ]
  },
  {
    profileId: "profile_002",
    persona: "latin_hit_hunter",
    country: "Argentina",
    favouriteGenres: ["Latin Pop", "Funk", "Reggaeton"],
    behaviourType: "mainstream_plus_discovery",
    engagementLevel: "high",
    feed: [
      {
        id: "pfeed_003",
        artist: "Demo Artist Brazil",
        reason: "Strong regional relevance and viral growth.",
        action: "play_now",
        icon: "🌎"
      },
      {
        id: "pfeed_004",
        artist: "Demo Artist Greece",
        reason: "A hidden gem outside your core taste that may still connect.",
        action: "discover_hidden_gem",
        icon: "💎"
      }
    ]
  },
  {
    profileId: "profile_003",
    persona: "regional_trend_watcher",
    country: "Japan",
    favouriteGenres: ["J-Pop", "Pop", "Electronic"],
    behaviourType: "trend_watcher",
    engagementLevel: "medium",
    feed: [
      {
        id: "pfeed_005",
        artist: "Demo Artist Japan",
        reason: "Regional trend growth matches your listening behaviour.",
        action: "watch_now",
        icon: "📡"
      },
      {
        id: "pfeed_006",
        artist: "Demo Artist Nigeria",
        reason: "Global breakout signal worth testing in your feed.",
        action: "try_breakout",
        icon: "⚡"
      }
    ]
  },
  {
    profileId: "profile_004",
    persona: "hidden_gem_hunter",
    country: "Greece",
    favouriteGenres: ["Indie", "Pop", "Alternative"],
    behaviourType: "discovery_first",
    engagementLevel: "medium",
    feed: [
      {
        id: "pfeed_007",
        artist: "Demo Artist Greece",
        reason: "Strong hidden gem alignment with your discovery style.",
        action: "discover_hidden_gem",
        icon: "💎"
      },
      {
        id: "pfeed_008",
        artist: "Demo Artist Japan",
        reason: "Emerging momentum with crossover potential.",
        action: "watch_now",
        icon: "✨"
      }
    ]
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getHighEngagementProfiles() {
  return PERSONALISED_FEEDS.filter(
    (profile) => profile.engagementLevel === "high"
  );
}

function getRandomProfile() {
  const index = Math.floor(Math.random() * PERSONALISED_FEEDS.length);
  return {
    ...PERSONALISED_FEEDS[index],
    generatedAt: new Date().toISOString()
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/personalised-feed
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "H46 Feed Personalisation Engine live.",
    count: PERSONALISED_FEEDS.length,
    routes: [
      "/api/personalised-feed",
      "/api/personalised-feed/list",
      "/api/personalised-feed/high-engagement",
      "/api/personalised-feed/random"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/personalised-feed/list
|--------------------------------------------------------------------------
*/

router.get("/list", (req, res) => {
  return res.json({
    success: true,
    count: PERSONALISED_FEEDS.length,
    profiles: PERSONALISED_FEEDS
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/personalised-feed/high-engagement
|--------------------------------------------------------------------------
*/

router.get("/high-engagement", (req, res) => {
  const profiles = getHighEngagementProfiles();

  return res.json({
    success: true,
    count: profiles.length,
    profiles
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/personalised-feed/random
|--------------------------------------------------------------------------
*/

router.get("/random", (req, res) => {
  return res.json({
    success: true,
    profile: getRandomProfile()
  });
});

export default router;