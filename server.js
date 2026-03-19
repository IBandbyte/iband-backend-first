import express from "express";
import cors from "cors";

const app = express();

const PORT = process.env.PORT || 10000;
const NODE_ENV = process.env.NODE_ENV || "development";

/*
|--------------------------------------------------------------------------
| Middleware
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
    version: "H50-predictive-feed-engine",
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
      "smart-feed",
      "personalised-feed",
      "feed-diversity",
      "engagement-optimiser",
      "session-learning",
      "predictive-feed"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| Boot route mounting
|--------------------------------------------------------------------------
*/

async function startServer() {

  // EXISTING CORE
  await mountRoute("/api/smart-feed", "./smartFeed.js");
  await mountRoute("/api/personalised-feed", "./personalisedFeed.js");
  await mountRoute("/api/feed-diversity", "./feedDiversity.js");
  await mountRoute("/api/engagement-optimiser", "./engagementOptimiser.js");

  // H49
  await mountRoute("/api/session-learning", "./sessionLearning.js");

  /*
  |--------------------------------------------------------------------------
  | H50 Predictive Feed Engine
  |--------------------------------------------------------------------------
  */

  await mountRoute("/api/predictive-feed", "./predictiveFeed.js");

  /*
  |--------------------------------------------------------------------------
  | 404
  |--------------------------------------------------------------------------
  */

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