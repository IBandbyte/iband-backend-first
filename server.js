import express from "express";
import cors from "cors";

const app = express();

const PORT = process.env.PORT || 10000;
const NODE_ENV = process.env.NODE_ENV || "development";

/*
|--------------------------------------------------------------------------
| Core middleware
|--------------------------------------------------------------------------
*/

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/*
|--------------------------------------------------------------------------
| Safe dynamic route mounting
|--------------------------------------------------------------------------
*/

async function mountRoute(basePath, importPath) {
  try {
    const mod = await import(importPath);
    const router = mod.default || mod;

    if (!router) {
      console.log(`[mount:skip] ${basePath} -> ${importPath} (no_router_export)`);
      return;
    }

    app.use(basePath, router);
    console.log(`[mount:ok] ${basePath} -> ${importPath}`);
  } catch (error) {
    if (
      error?.code === "ERR_MODULE_NOT_FOUND" ||
      error?.code === "MODULE_NOT_FOUND"
    ) {
      console.log(`[mount:skip] ${basePath} -> ${importPath} (missing_file)`);
      return;
    }

    console.log(
      `[mount:skip] ${basePath} -> ${importPath} (${error?.code || "load_error"})`
    );
  }
}

/*
|--------------------------------------------------------------------------
| Root
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  return res.json({
    success: true,
    service: "iband-backend-first",
    app: "iBand",
    platform: "iBandbyte",
    company: "iBandbyte Ltd",
    environment: NODE_ENV,
    version: "H25-discovery-rewards-engine",
    message: "iBand backend is live.",
    now: new Date().toISOString()
  });
});

/*
|--------------------------------------------------------------------------
| Health
|--------------------------------------------------------------------------
*/

app.get("/health", (req, res) => {
  return res.json({
    success: true,
    status: "ok",
    uptimeSec: Math.floor(process.uptime()),
    now: new Date().toISOString()
  });
});

/*
|--------------------------------------------------------------------------
| API root
|--------------------------------------------------------------------------
*/

app.get("/api", (req, res) => {
  return res.json({
    success: true,
    message: "iBand API root",
    modules: [
      "artists",
      "votes",
      "ranking",
      "medals",
      "recs",
      "flash-medals",
      "achievements",
      "purchases",
      "monetisation",
      "shares",
      "trends",
      "ambassadors",
      "moderation",
      "rooms",
      "fans",
      "genres",
      "countries",
      "discovery",
      "world-map",
      "breakouts",
      "cross-border",
      "cross-border-momentum",
      "fan-impact",
      "fan-power",
      "trend-starter",
      "momentum-charts",
      "surge",
      "discovery-boost",
      "rising-now",
      "country-engine",
      "map-activity",
      "signal-weight",
      "explosion",
      "map-intelligence",
      "radar",
      "map-feed",
      "alerts",
      "live-heat",
      "spin",
      "adventure",
      "warp-drive",
      "missions",
      "explorer-rank",
      "xp",
      "rewards"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| Boot route mounting
|--------------------------------------------------------------------------
*/

async function startServer() {
  await mountRoute("/api/artists", "./artists.js");
  await mountRoute("/api/votes", "./votes.js");
  await mountRoute("/api/ranking", "./ranking.js");
  await mountRoute("/api/medals", "./medals.js");
  await mountRoute("/api/recs", "./recs.js");
  await mountRoute("/api/flash-medals", "./flashMedals.js");
  await mountRoute("/api/achievements", "./achievements.js");
  await mountRoute("/api/purchases", "./purchases.js");
  await mountRoute("/api/monetisation", "./monetisationSignals.js");
  await mountRoute("/api/shares", "./shares.js");
  await mountRoute("/api/trends", "./trends.js");
  await mountRoute("/api/ambassadors", "./ambassadors.js");
  await mountRoute("/api/moderation", "./moderation.js");
  await mountRoute("/api/rooms", "./rooms.js");
  await mountRoute("/api/fans", "./fanProfiles.js");
  await mountRoute("/api/genres", "./genres.js");
  await mountRoute("/api/countries", "./countries.js");
  await mountRoute("/api/discovery", "./discovery.js");
  await mountRoute("/api/world-map", "./world-map.js");

  await mountRoute("/api/breakouts", "./breakouts.js");
  await mountRoute("/api/cross-border", "./cross-border.js");
  await mountRoute("/api/cross-border-momentum", "./cross-border-momentum.js");

  await mountRoute("/api/fan-impact", "./fan-impact.js");
  await mountRoute("/api/fan-power", "./fan-power.js");

  await mountRoute("/api/trend-starter", "./trend-starter.js");
  await mountRoute("/api/momentum-charts", "./momentum-charts.js");
  await mountRoute("/api/surge", "./surge-detector.js");

  await mountRoute("/api/discovery-boost", "./discovery-boost.js");
  await mountRoute("/api/rising-now", "./rising-now.js");

  await mountRoute("/api/country-engine", "./countryEngine.js");
  await mountRoute("/api/map-activity", "./mapActivity.js");
  await mountRoute("/api/breakout", "./breakouts.js");
  await mountRoute("/api/signal-weight", "./signalWeight.js");
  await mountRoute("/api/explosion", "./explosion.js");
  await mountRoute("/api/map-intelligence", "./mapIntelligence.js");
  await mountRoute("/api/radar", "./radar.js");
  await mountRoute("/api/map-feed", "./mapFeed.js");
  await mountRoute("/api/alerts", "./alerts.js");
  await mountRoute("/api/live-heat", "./liveHeat.js");
  await mountRoute("/api/spin", "./spin.js");

  await mountRoute("/api/adventure", "./discoveryAdventure.js");
  await mountRoute("/api/warp-drive", "./warpDrive.js");
  await mountRoute("/api/missions", "./missions.js");
  await mountRoute("/api/explorer-rank", "./explorerRank.js");
  await mountRoute("/api/xp", "./xp.js");

  /*
  |--------------------------------------------------------------------------
  | H25 Discovery Rewards Engine
  |--------------------------------------------------------------------------
  */

  await mountRoute("/api/rewards", "./rewards.js");

  app.use((req, res) => {
    return res.status(404).json({
      success: false,
      message: "Route not found"
    });
  });

  app.listen(PORT, () => {
    console.log(`[boot] iband-backend-first listening on port ${PORT}`);
  });
}

startServer();