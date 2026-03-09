// server.js (ESM) — iBand backend (root-level structure)
// Phase H11: World Map engine mounted with safe module loader.

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_NAME = "iband-backend-first";
const VERSION = 1;
const STARTED_AT = new Date().toISOString();

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const NODE_ENV = process.env.NODE_ENV || "production";

const app = express();
app.set("trust proxy", 1);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()"
  );
  next();
});

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

app.use(express.json({ limit: "250kb" }));
app.use(express.urlencoded({ extended: true, limit: "250kb" }));

function jsonOk(res, payload) {
  res.status(200).json(payload);
}

function jsonError(res, status, error, extra = {}) {
  res.status(status).json({ success: false, error, ...extra });
}

async function safeImportLocal(modulePath) {
  const abs = path.resolve(__dirname, modulePath);
  if (!fs.existsSync(abs)) return { ok: false, reason: "missing_file", abs };

  try {
    const modUrl = pathToFileURL(abs).href;
    const mod = await import(modUrl);
    return { ok: true, mod, abs };
  } catch (err) {
    return { ok: false, reason: "import_error", abs, err };
  }
}

async function safeMount({ basePath, modulePath, exportName = "default" }) {
  const loaded = await safeImportLocal(modulePath);

  if (!loaded.ok) {
    console.warn(
      `[mount:skip] ${basePath} -> ${modulePath} (${loaded.reason}) ${
        loaded.abs || ""
      }`
    );
    return { mounted: false, reason: loaded.reason };
  }

  const candidate =
    loaded.mod?.[exportName] ?? loaded.mod?.router ?? loaded.mod;

  if (!candidate) {
    console.warn(`[mount:skip] ${basePath} -> ${modulePath} (no_export_found)`);
    return { mounted: false, reason: "no_export_found" };
  }

  app.use(basePath, candidate);
  console.log(`[mount:ok] ${basePath} -> ${modulePath}`);
  return { mounted: true };
}

app.get("/", (req, res) => {
  jsonOk(res, {
    success: true,
    app: APP_NAME,
    env: NODE_ENV,
    version: VERSION,
    startedAt: STARTED_AT,
  });
});

app.get("/api/health", (req, res) => {
  jsonOk(res, {
    success: true,
    app: APP_NAME,
    env: NODE_ENV,
    startedAt: STARTED_AT,
    ts: new Date().toISOString(),
  });
});

const mounts = [
  { basePath: "/api/artists", modulePath: "./artists.js" },
  { basePath: "/api/votes", modulePath: "./votes.js" },
  { basePath: "/api/ranking", modulePath: "./ranking.js" },
  { basePath: "/api/medals", modulePath: "./medals.js" },
  { basePath: "/api/recs", modulePath: "./recs.js" },

  { basePath: "/api/flash-medals", modulePath: "./flashMedals.js" },
  { basePath: "/api/achievements", modulePath: "./achievements.js" },

  { basePath: "/api/purchases", modulePath: "./purchases.js" },
  { basePath: "/api/monetisation", modulePath: "./monetisationSignals.js" },

  { basePath: "/api/shares", modulePath: "./shares.js" },
  { basePath: "/api/trends", modulePath: "./trends.js" },

  { basePath: "/api/ambassadors", modulePath: "./ambassadors.js" },
  { basePath: "/api/moderation", modulePath: "./moderation.js" },

  { basePath: "/api/rooms", modulePath: "./rooms.js" },
  { basePath: "/api/fans", modulePath: "./fanProfiles.js" },
  { basePath: "/api/genres", modulePath: "./genres.js" },
  { basePath: "/api/countries", modulePath: "./countries.js" },

  // Discovery Engine
  { basePath: "/api/discovery", modulePath: "./discovery.js" },

  // World Map Engine (H11)
  { basePath: "/api/world-map", modulePath: "./world-map.js" },
];

(async () => {
  for (const m of mounts) {
    await safeMount(m);
  }

  app.use((req, res) => {
    jsonError(res, 404, "not_found", { path: req.originalUrl });
  });

  app.use((err, req, res, next) => {
    console.error("[unhandled_error]", err);
    jsonError(res, 500, "server_error", {
      message:
        NODE_ENV === "production"
          ? "Internal Server Error"
          : String(err?.message || err),
    });
  });

  app.listen(PORT, () => {
    console.log(`[boot] ${APP_NAME} listening on port ${PORT} (${NODE_ENV})`);
  });
})().catch((err) => {
  console.error("[boot_fatal]", err);
  process.exit(1);
});