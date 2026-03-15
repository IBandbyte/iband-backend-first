import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H25 Discovery Rewards Engine
|--------------------------------------------------------------------------
| Converts exploration achievements into unlockable rewards.
|--------------------------------------------------------------------------
*/

const REWARDS = [
  {
    id: "reward_01",
    type: "badge",
    name: "First Discovery",
    icon: "🌍",
    requirement: {
      countriesVisited: 3
    }
  },
  {
    id: "reward_02",
    type: "instrument",
    name: "Instrument Collector",
    icon: "🎸",
    requirement: {
      instrumentsCollected: 10
    }
  },
  {
    id: "reward_03",
    type: "medal",
    name: "Mission Starter",
    icon: "🏅",
    requirement: {
      missionsCompleted: 1
    }
  },
  {
    id: "reward_04",
    type: "badge",
    name: "Explorer Rank Achieved",
    icon: "🧭",
    requirement: {
      countriesVisited: 8,
      missionsCompleted: 2
    }
  },
  {
    id: "reward_05",
    type: "boost",
    name: "Discovery Boost",
    icon: "🚀",
    requirement: {
      artistsDiscovered: 10
    }
  }
];

const DEMO_ACTIVITY = {
  countriesVisited: 8,
  instrumentsCollected: 32,
  missionsCompleted: 2,
  artistsDiscovered: 14
};

/*
|--------------------------------------------------------------------------
| Reward Logic
|--------------------------------------------------------------------------
*/

function checkRewardUnlocked(reward, stats) {
  const req = reward.requirement;

  if (req.countriesVisited && stats.countriesVisited < req.countriesVisited) {
    return false;
  }

  if (req.instrumentsCollected && stats.instrumentsCollected < req.instrumentsCollected) {
    return false;
  }

  if (req.missionsCompleted && stats.missionsCompleted < req.missionsCompleted) {
    return false;
  }

  if (req.artistsDiscovered && stats.artistsDiscovered < req.artistsDiscovered) {
    return false;
  }

  return true;
}

function evaluateRewards(stats) {
  return REWARDS.map(reward => ({
    ...reward,
    unlocked: checkRewardUnlocked(reward, stats)
  }));
}

/*
|--------------------------------------------------------------------------
| GET /api/rewards
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  const rewards = evaluateRewards(DEMO_ACTIVITY);

  res.json({
    success: true,
    message: "H25 Discovery Rewards Engine live.",
    rewards
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/rewards/list
|--------------------------------------------------------------------------
*/

router.get("/list", (req, res) => {
  res.json({
    success: true,
    rewards: REWARDS
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/rewards/unlocked
|--------------------------------------------------------------------------
*/

router.get("/unlocked", (req, res) => {
  const rewards = evaluateRewards(DEMO_ACTIVITY);
  const unlocked = rewards.filter(r => r.unlocked);

  res.json({
    success: true,
    unlocked
  });
});

export default router;