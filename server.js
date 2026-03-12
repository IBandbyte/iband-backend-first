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
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/*
|--------------------------------------------------------------------------
| Safe route loading helper
|--------------------------------------------------------------------------
*/
async function tryLoadRoute(importPath) {
  try {
    const mod = await import(importPath);
    return mod.default || mod;
  } catch (error) {
    console.warn(`[route-loader] Could not load ${importPath}: ${error.message}`);
    return null;
  }
}

/*
|--------------------------------------------------------------------------
| Bootstrap routes and start server
|--------------------------------------------------------------------------
*/
async function startServer() {

  const artistsRoute = await tryLoadRoute("./artists.js");
  const countryEngineRoute = await tryLoadRoute("./countryEngine.js");
  const worldMapRoute = await tryLoadRoute("./world-map.js");
  const crossBorderRoute = await tryLoadRoute("./cross-border.js");
  const mapActivityRoute = await tryLoadRoute("./mapActivity.js");

  /*
  |--------------------------------------------------------------------------
  | Base routes
  |--------------------------------------------------------------------------
  */
  app.get("/", (req, res) => {
    return res.status(200).json({
      success: true,
      name: "iBandbyte API",
      app: "iBand",
      platform: "iBandbyte",
      company: "iBandbyte Ltd",
      environment: NODE_ENV,
      version: "H10-map-activity",
      message: "iBand backend is live.",
      modules: {
        artists: Boolean(artistsRoute),
        countryEngine: Boolean(countryEngineRoute),
        worldMap: Boolean(worldMapRoute),
        crossBorder: Boolean(crossBorderRoute),
        mapActivity: Boolean(mapActivityRoute)
      },
      timestamps: {
        now: new Date().toISOString(),
      },
    });
  });

  app.get("/health", (req, res) => {
    return res.status(200).json({
      success: true,
      status: "ok",
      service: "iband-backend",
      environment: NODE_ENV,
      uptimeSec: Math.floor(process.uptime()),
      now: new Date().toISOString(),
    });
  });

  app.get("/api", (req, res) => {
    return res.status(200).json({
      success: true,
      message: "iBand API root",
      availableGroups: [
        "/api/artists",
        "/api/country-engine",
        "/api/world-map",
        "/api/cross-border",
        "/api/map-activity"
      ],
    });
  });

  /*
  |--------------------------------------------------------------------------
  | Mounted route groups
  |--------------------------------------------------------------------------
  */

  if (artistsRoute) app.use("/api/artists", artistsRoute);
  if (countryEngineRoute) app.use("/api/country-engine", countryEngineRoute);
  if (worldMapRoute) app.use("/api/world-map", worldMapRoute);
  if (crossBorderRoute) app.use("/api/cross-border", crossBorderRoute);
  if (mapActivityRoute) app.use("/api/map-activity", mapActivityRoute);

  /*
  |--------------------------------------------------------------------------
  | 404 handler
  |--------------------------------------------------------------------------
  */
  app.use((req, res) => {
    return res.status(404).json({
      success: false,
      message: "Route not found.",
      method: req.method,
      path: req.originalUrl,
    });
  });

  /*
  |--------------------------------------------------------------------------
  | Global error handler
  |--------------------------------------------------------------------------
  */
  app.use((error, req, res, next) => {
    console.error("[server-error]", error);

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Internal server error.",
    });
  });

  /*
  |--------------------------------------------------------------------------
  | Server start
  |--------------------------------------------------------------------------
  */
  app.listen(PORT, () => {
    console.log(`[boot] iband-backend listening on port ${PORT}`);
    console.log(`[env] ${NODE_ENV}`);
  });
}

startServer().catch((error) => {
  console.error("[startup-error]", error);
  process.exit(1);
});