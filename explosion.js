import express from "express";
import { getArtistBreakout, getTopBreakouts } from "./breakoutEngine.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H13 Breakout Explosion Detector
|--------------------------------------------------------------------------
| Detects when an artist has reached explosion-level momentum.
| This is the first version of the engine and currently uses breakout
| scores as the main source of truth. Later versions can incorporate:
| - country spread
| - cross-border momentum
| - map activity
| - livestream signals
|--------------------------------------------------------------------------
*/

const EXPLOSION_THRESHOLD = 800;

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function buildExplosionResult(artistId) {
  const breakout = getArtistBreakout(artistId);

  const isExplosion = breakout.score >= EXPLOSION_THRESHOLD;

  return {
    artistId: breakout.artistId,
    score: breakout.score,
    breakoutStage: breakout.stage,
    explosion: {
      detected: isExplosion,
      threshold: EXPLOSION_THRESHOLD,
      color: isExplosion ? "gold" : breakout.stage.color,
      icon: isExplosion ? "💥" : breakout.stage.icon,
      label: isExplosion ? "breakout_explosion" : "not_exploded"
    }
  };
}

/*
|--------------------------------------------------------------------------
| GET
| Root summary
|--------------------------------------------------------------------------
*/
router.get("/", (req, res) => {
  const top = getTopBreakouts(50);
  const explosions = top.filter((artist) => artist.score >= EXPLOSION_THRESHOLD);

  return res.json({
    success: true,
    message: "H13 Breakout Explosion Detector live.",
    threshold: EXPLOSION_THRESHOLD,
    trackedArtists: top.length,
    explosionsDetected: explosions.length,
    routes: [
      "/api/explosion",
      "/api/explosion/top",
      "/api/explosion/:artistId"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Top explosion candidates
|--------------------------------------------------------------------------
*/
router.get("/top", (req, res) => {
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 10;

  const top = getTopBreakouts(limit).map((artist) =>
    buildExplosionResult(artist.artistId)
  );

  return res.json({
    success: true,
    count: top.length,
    artists: top
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Single artist explosion status
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

  const result = buildExplosionResult(artistId);

  return res.json({
    success: true,
    ...result
  });
});

export default router;