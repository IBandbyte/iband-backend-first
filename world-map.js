import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| World Map Activity Engine
|--------------------------------------------------------------------------
| Provides map-ready country activity data for iBand discovery.
| Data can later be connected to countryEngine signals or a database.
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| Temporary in-memory activity store
|--------------------------------------------------------------------------
*/

const worldActivity = {};

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function ensureCountry(country) {
  if (!worldActivity[country]) {
    worldActivity[country] = {
      country,
      signals: 0,
      lastActivity: null,
    };
  }
}

/*
|--------------------------------------------------------------------------
| GET
| Map activity summary
|--------------------------------------------------------------------------
*/

router.get("/activity", (req, res) => {
  const countries = Object.values(worldActivity).sort(
    (a, b) => b.signals - a.signals
  );

  return res.json({
    success: true,
    count: countries.length,
    countries,
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Single country activity
|--------------------------------------------------------------------------
*/

router.get("/country/:country", (req, res) => {
  const country = req.params.country;

  if (!worldActivity[country]) {
    return res.json({
      success: true,
      country,
      signals: 0,
      message: "No activity recorded yet.",
    });
  }

  return res.json({
    success: true,
    ...worldActivity[country],
  });
});

/*
|--------------------------------------------------------------------------
| POST
| Record world activity signal
|--------------------------------------------------------------------------
*/

router.post("/signal", (req, res) => {
  const { country } = req.body;

  if (!country) {
    return res.status(400).json({
      success: false,
      message: "country is required",
    });
  }

  ensureCountry(country);

  worldActivity[country].signals += 1;
  worldActivity[country].lastActivity = new Date().toISOString();

  return res.json({
    success: true,
    message: "World map signal recorded",
    country: worldActivity[country],
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Top countries
|--------------------------------------------------------------------------
*/

router.get("/top", (req, res) => {
  const countries = Object.values(worldActivity)
    .sort((a, b) => b.signals - a.signals)
    .slice(0, 20);

  return res.json({
    success: true,
    countries,
  });
});

export default router;