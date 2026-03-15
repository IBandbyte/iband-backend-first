import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H24 Discovery XP Engine
|--------------------------------------------------------------------------
| Awards XP for discovery actions and returns level progress.
|--------------------------------------------------------------------------
*/

const XP_VALUES = {
  country_visit: 20,
  artist_discovery: 15,
  instrument_unlock: 25,
  mission_complete: 100,
  vote: 5,
  comment: 8,
  fan_support: 12
};

const DEMO_ACTIVITY = {
  countryVisits: 8,
  artistsDiscovered: 14,
  instrumentsUnlocked: 32,
  missionsCompleted: 2,
  votesCast: 18,
  commentsMade: 7,
  fanSupportActions: 5
};

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function calculateTotalXp(activity) {
  return (
    activity.countryVisits * XP_VALUES.country_visit +
    activity.artistsDiscovered * XP_VALUES.artist_discovery +
    activity.instrumentsUnlocked * XP_VALUES.instrument_unlock +
    activity.missionsCompleted * XP_VALUES.mission_complete +
    activity.votesCast * XP_VALUES.vote +
    activity.commentsMade * XP_VALUES.comment +
    activity.fanSupportActions * XP_VALUES.fan_support
  );
}

function calculateLevel(totalXp) {
  const level = Math.floor(totalXp / 250) + 1;
  const currentLevelMinXp = (level - 1) * 250;
  const nextLevelMinXp = level * 250;

  return {
    level,
    currentLevelMinXp,
    nextLevelMinXp,
    progressXp: totalXp - currentLevelMinXp,
    progressNeeded: nextLevelMinXp - totalXp
  };
}

function buildXpProfile(activity) {
  const totalXp = calculateTotalXp(activity);
  const level = calculateLevel(totalXp);

  return {
    activity,
    totalXp,
    level
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/xp
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  const xpProfile = buildXpProfile(DEMO_ACTIVITY);

  return res.json({
    success: true,
    message: "H24 Discovery XP Engine live.",
    xpProfile,
    routes: [
      "/api/xp",
      "/api/xp/values",
      "/api/xp/profile"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/xp/values
|--------------------------------------------------------------------------
*/

router.get("/values", (req, res) => {
  return res.json({
    success: true,
    xpValues: XP_VALUES
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/xp/profile
|--------------------------------------------------------------------------
*/

router.get("/profile", (req, res) => {
  const xpProfile = buildXpProfile(DEMO_ACTIVITY);

  return res.json({
    success: true,
    xpProfile
  });
});

export default router;