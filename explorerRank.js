import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H23 Explorer Rank Engine
|--------------------------------------------------------------------------
| Calculates explorer rank from discovery activity.
|--------------------------------------------------------------------------
*/

const RANKS = [
  {
    key: "new_listener",
    minCountries: 0,
    minInstruments: 0,
    minMissions: 0,
    label: "New Listener",
    icon: "🎧"
  },
  {
    key: "music_tourist",
    minCountries: 3,
    minInstruments: 6,
    minMissions: 1,
    label: "Music Tourist",
    icon: "🌍"
  },
  {
    key: "music_traveller",
    minCountries: 6,
    minInstruments: 12,
    minMissions: 2,
    label: "Music Traveller",
    icon: "🧳"
  },
  {
    key: "sound_explorer",
    minCountries: 10,
    minInstruments: 20,
    minMissions: 3,
    label: "Sound Explorer",
    icon: "🧭"
  },
  {
    key: "global_music_hunter",
    minCountries: 15,
    minInstruments: 30,
    minMissions: 4,
    label: "Global Music Hunter",
    icon: "🚀"
  },
  {
    key: "world_sound_master",
    minCountries: 25,
    minInstruments: 50,
    minMissions: 6,
    label: "World Sound Master",
    icon: "👑"
  }
];

/*
|--------------------------------------------------------------------------
| Demo profile stats
|--------------------------------------------------------------------------
| Later this becomes user-specific from DB
|--------------------------------------------------------------------------
*/

const DEMO_PROFILE = {
  countriesVisited: 8,
  instrumentsCollected: 32,
  missionsCompleted: 2,
  artistsDiscovered: 14
};

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function calculateRank(profile) {
  let currentRank = RANKS[0];

  for (const rank of RANKS) {
    if (
      profile.countriesVisited >= rank.minCountries &&
      profile.instrumentsCollected >= rank.minInstruments &&
      profile.missionsCompleted >= rank.minMissions
    ) {
      currentRank = rank;
    }
  }

  return currentRank;
}

function getNextRank(currentKey) {
  const index = RANKS.findIndex((rank) => rank.key === currentKey);
  if (index === -1 || index === RANKS.length - 1) {
    return null;
  }
  return RANKS[index + 1];
}

function buildExplorerProfile(profile) {
  const currentRank = calculateRank(profile);
  const nextRank = getNextRank(currentRank.key);

  return {
    stats: profile,
    currentRank,
    nextRank
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/explorer-rank
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  const explorer = buildExplorerProfile(DEMO_PROFILE);

  return res.json({
    success: true,
    message: "H23 Explorer Rank Engine live.",
    explorer,
    routes: [
      "/api/explorer-rank",
      "/api/explorer-rank/ranks",
      "/api/explorer-rank/profile"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/explorer-rank/ranks
|--------------------------------------------------------------------------
*/

router.get("/ranks", (req, res) => {
  return res.json({
    success: true,
    count: RANKS.length,
    ranks: RANKS
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/explorer-rank/profile
|--------------------------------------------------------------------------
*/

router.get("/profile", (req, res) => {
  const explorer = buildExplorerProfile(DEMO_PROFILE);

  return res.json({
    success: true,
    explorer
  });
});

export default router;