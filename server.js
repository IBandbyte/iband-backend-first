require("dotenv").config();

const express = require("express");
const cors = require("cors");

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
function tryLoadRoute(modulePath) {
  try {
    return require(modulePath);
  } catch (error) {
    console.warn(`[route-loader] Could not load ${modulePath}: ${error.message}`);
    return null;
  }
}

/*
|--------------------------------------------------------------------------
| Route modules
|--------------------------------------------------------------------------
| Keep root-based project structure exactly as established:
| /server.js
| /artists.js
| /countryEngine.js
|--------------------------------------------------------------------------
*/
const artistsRoute = tryLoadRoute("./artists");
const countryEngineRoute = tryLoadRoute("./countryEngine");

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
    version: "H7-country-engine-live",
    message: "iBand backend is live.",
    modules: {
      artists: Boolean(artistsRoute),
      countryEngine: Boolean(countryEngineRoute),
    },
    rankingPhilosophy: {
      popularityVisible: true,
      momentumPrimary: true,
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
    availableGroups: ["/api/artists", "/api/country-engine"],
  });
});

/*
|--------------------------------------------------------------------------
| Mounted route groups
|--------------------------------------------------------------------------
*/
if (artistsRoute) {
  app.use("/api/artists", artistsRoute);
}

if (countryEngineRoute) {
  app.use("/api/country-engine", countryEngineRoute);
}

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
  console.log(`iBand backend running on port ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
});