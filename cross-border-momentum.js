import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Cross-Border Momentum Engine (H9)
|--------------------------------------------------------------------------
| Detects songs spreading between countries.
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| In-memory store
|--------------------------------------------------------------------------
*/

const spreadSignals = {};
const crossBorderEvents = [];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function ensureArtist(artistId) {
  if (!spreadSignals[artistId]) {
    spreadSignals[artistId] = {
      artistId,
      countries: [],
      signals: 0,
      firstSeen: new Date().toISOString(),
    };
  }
}

/*
|--------------------------------------------------------------------------
| POST
| Record spread signal
|--------------------------------------------------------------------------
*/

router.post("/signal", (req, res) => {
  const { artistId, country } = req.body;

  if (!artistId || !country) {
    return res.status(400).json({
      success: false,
      message: "artistId and country are required",
    });
  }

  ensureArtist(artistId);

  const artistData = spreadSignals[artistId];

  artistData.signals += 1;

  if (!artistData.countries.includes(country)) {
    artistData.countries.push(country);

    if (artistData.countries.length > 1) {
      const event = {
        artistId,
        spreadTo: country,
        countries: [...artistData.countries],
        detectedAt: new Date().toISOString(),
      };

      crossBorderEvents.push(event);
    }
  }

  return res.json({
    success: true,
    message: "Spread signal recorded",
    artist: spreadSignals[artistId],
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Artist spread pattern
|--------------------------------------------------------------------------
*/

router.get("/artist/:artistId", (req, res) => {
  const artistId = req.params.artistId;

  if (!spreadSignals[artistId]) {
    return res.json({
      success: true,
      artistId,
      countries: [],
      signals: 0,
    });
  }

  return res.json({
    success: true,
    ...spreadSignals[artistId],
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Cross-border events
|--------------------------------------------------------------------------
*/

router.get("/events", (req, res) => {
  return res.json({
    success: true,
    count: crossBorderEvents.length,
    events: crossBorderEvents,
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Top spreading artists
|--------------------------------------------------------------------------
*/

router.get("/top", (req, res) => {
  const artists = Object.values(spreadSignals)
    .sort((a, b) => b.countries.length - a.countries.length)
    .slice(0, 20);

  return res.json({
    success: true,
    artists,
  });
});

export default router;