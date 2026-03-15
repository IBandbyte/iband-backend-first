import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H22 Discovery Missions Engine
|--------------------------------------------------------------------------
| Powers:
| - mission-based discovery quests
| - country / region / genre goals
| - reward loops
| - medal-ready progression
|--------------------------------------------------------------------------
*/

const MISSIONS = [
  {
    id: "mission_latam_01",
    title: "Latin Explorer",
    description: "Discover 3 Latin countries and explore their music scenes.",
    category: "country",
    goals: {
      countriesToDiscover: 3,
      genreExplores: 3,
      artistVisits: 3
    },
    reward: {
      type: "medal",
      name: "Latin Explorer Medal",
      icon: "🏅"
    }
  },
  {
    id: "mission_africa_01",
    title: "Rhythm of Africa",
    description: "Visit 3 African countries and unlock 3 instruments.",
    category: "country",
    goals: {
      countriesToDiscover: 3,
      instrumentsToUnlock: 3
    },
    reward: {
      type: "medal",
      name: "Rhythm Explorer Medal",
      icon: "🥁"
    }
  },
  {
    id: "mission_asia_01",
    title: "Eastern Sounds",
    description: "Explore 2 Asian countries and collect 2 traditional instruments.",
    category: "country",
    goals: {
      countriesToDiscover: 2,
      instrumentsToUnlock: 2
    },
    reward: {
      type: "souvenir",
      name: "Eastern Sounds Badge",
      icon: "🎎"
    }
  },
  {
    id: "mission_genre_01",
    title: "Genre Jumper",
    description: "Explore 5 different genres across the global music map.",
    category: "genre",
    goals: {
      genresToExplore: 5
    },
    reward: {
      type: "badge",
      name: "Genre Jumper Badge",
      icon: "🎵"
    }
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getMissionById(id) {
  return MISSIONS.find((mission) => mission.id === id);
}

function buildMissionSummary() {
  return {
    totalMissions: MISSIONS.length,
    categories: [...new Set(MISSIONS.map((mission) => mission.category))],
    rewards: MISSIONS.map((mission) => ({
      id: mission.id,
      reward: mission.reward
    }))
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/missions
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "H22 Discovery Missions Engine live.",
    summary: buildMissionSummary(),
    routes: [
      "/api/missions",
      "/api/missions/list",
      "/api/missions/:id"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/missions/list
|--------------------------------------------------------------------------
*/

router.get("/list", (req, res) => {
  return res.json({
    success: true,
    count: MISSIONS.length,
    missions: MISSIONS
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/missions/:id
|--------------------------------------------------------------------------
*/

router.get("/:id", (req, res) => {
  const mission = getMissionById(req.params.id);

  if (!mission) {
    return res.status(404).json({
      success: false,
      message: "Mission not found"
    });
  }

  return res.json({
    success: true,
    mission
  });
});

export default router;