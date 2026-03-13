import express from "express";
import {
  recordBreakoutSignal,
  getArtistBreakout,
  getAllBreakouts,
  getTopBreakouts
} from "./breakoutEngine.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H11 Breakout API
|--------------------------------------------------------------------------
| Routes:
| - GET  /api/breakout
| - GET  /api/breakout/top
| - GET  /api/breakout/:artistId
| - POST /api/breakout/signal
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| GET
| Root summary
|--------------------------------------------------------------------------
*/
router.get("/", (req, res) => {
  const all = getAllBreakouts();

  return res.json({
    success: true,
    message: "H11 Breakout API live.",
    trackedArtists: all.length,
    routes: [
      "/api/breakout",
      "/api/breakout/top",
      "/api/breakout/:artistId",
      "/api/breakout/signal"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Top breakout artists
|--------------------------------------------------------------------------
*/
router.get("/top", (req, res) => {
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 10;

  const artists = getTopBreakouts(limit);

  return res.json({
    success: true,
    count: artists.length,
    artists
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Single artist breakout status
|--------------------------------------------------------------------------
*/
router.get("/:artistId", (req, res) => {
  const artistId = String(req.params.artistId || "").trim();

  if (!artistId) {
    return res.status(400).json({
      success: false,
      message: "artistId is required"
    });
  }

  const result = getArtistBreakout(artistId);

  return res.json({
    success: true,
    ...result
  });
});

/*
|--------------------------------------------------------------------------
| POST
| Record breakout signal
|--------------------------------------------------------------------------
*/
router.post("/signal", (req, res) => {
  const { artistId, type, value } = req.body;

  if (!artistId) {
    return res.status(400).json({
      success: false,
      message: "artistId is required"
    });
  }

  const numericValue = Number(value);
  const safeValue =
    Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 1;

  const signal = recordBreakoutSignal(
    String(artistId).trim(),
    String(type || "play").trim(),
    safeValue
  );

  const breakout = getArtistBreakout(String(artistId).trim());

  return res.json({
    success: true,
    message: "Breakout signal recorded.",
    signal,
    breakout
  });
});

export default router;