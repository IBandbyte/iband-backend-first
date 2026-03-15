import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H26 Hidden Gem Drop Engine
|--------------------------------------------------------------------------
| Random discovery rewards appearing during exploration.
|--------------------------------------------------------------------------
*/

const GEM_TYPES = [
  {
    type: "hidden_gem",
    icon: "💎",
    reward: {
      xp: 50,
      label: "Hidden Gem Discovery"
    }
  },
  {
    type: "instrument_drop",
    icon: "🎸",
    reward: {
      xp: 30,
      label: "Rare Instrument Found"
    }
  },
  {
    type: "country_discovery",
    icon: "🌎",
    reward: {
      xp: 40,
      label: "New Country Discovery"
    }
  },
  {
    type: "xp_boost",
    icon: "🚀",
    reward: {
      xp: 75,
      label: "XP Boost"
    }
  }
];

function randomGem() {
  const index = Math.floor(Math.random() * GEM_TYPES.length);
  const gem = GEM_TYPES[index];

  return {
    id: "gem_" + Math.random().toString(36).substring(2, 10),
    ...gem,
    discoveredAt: new Date().toISOString()
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/hidden-gems
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  const gem = randomGem();

  res.json({
    success: true,
    message: "H26 Hidden Gem Drop!",
    gem
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/hidden-gems/list
|--------------------------------------------------------------------------
*/

router.get("/list", (req, res) => {
  res.json({
    success: true,
    gemTypes: GEM_TYPES
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/hidden-gems/drop
|--------------------------------------------------------------------------
*/

router.get("/drop", (req, res) => {
  const gem = randomGem();

  res.json({
    success: true,
    drop: gem
  });
});

export default router;