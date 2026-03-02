/**
 * server.js (ESM - because package.json has "type":"module")
 * ----------------------------------------------------------
 * Future-proof Express server for iBand (Render)
 * - Safe-load route modules without crashing deploys
 * - Supports both ESM and CommonJS route files via dynamic import
 */

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Render / proxies
app.set("trust proxy", 1);

// Basic request id for logs
app.use((req, res, next) => {
  req.id = (Math.random().toString(16).slice(2) + Date.now().toString(16)).slice(0, 16);
  res.setHeader("x-request-id", req.id);
  next();
});

// CORS (lock down later with allowlist)
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Admin-Token", "X-Requested-With"]
  })
);

// Body parsing
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: true, limit: "200kb" }));

// Simple access log
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.ip} ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms) id=${req.id}`
    );
  });
  next();
});

// Health
app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "iband-backend",
    env: process.env.NODE_ENV || "development",
    ts: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.json({ success: true, status: "ok", ts: new Date().toISOString() });
});

// Safe-load helper (prevents server crash if a file is missing or invalid)
// Supports:
// - ESM: export default router
// - CJS: module.exports = router  (import() will expose it as default in Node)
async function mountIfExists({ file, mountPath }) {
  try {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) {
      console.warn(`Route module missing: ${file} (skipped)`);
      return;
    }

    const modUrl = pathToFileURL(fullPath).href;
    const imported = await import(modUrl);

    // If ESM: default export
    // If CJS: Node exposes module.exports as default
    const router = imported?.default ?? imported;

    if (typeof router !== "function") {
      console.warn(`Route module invalid (not a router): ${file} (skipped)`);
      return;
    }

    app.use(mountPath, router);
    console.log(`Mounted ${file} at ${mountPath}`);
  } catch (err) {
    console.error(`Failed to mount ${file} at ${mountPath}`, err);
  }
}

// Bootstrap (so we can await mounts)
async function start() {
  // ------------------------------
  // Mount existing iBand systems (root-level files)
  // ------------------------------
  await mountIfExists({ file: "votes.js", mountPath: "/api/votes" });
  await mountIfExists({ file: "ranking.js", mountPath: "/api/ranking" });
  await mountIfExists({ file: "medals.js", mountPath: "/api/medals" });
  await mountIfExists({ file: "recs.js", mountPath: "/api/recs" });

  await mountIfExists({ file: "flashMedals.js", mountPath: "/api/flash-medals" });
  await mountIfExists({ file: "achievements.js", mountPath: "/api/achievements" });

  await mountIfExists({ file: "purchases.js", mountPath: "/api/purchases" });

  // Phase H3: Monetisation Signals Engine
  await mountIfExists({ file: "monetisationSignals.js", mountPath: "/api/monetisation" });

  // 404
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: "not_found",
      path: req.originalUrl
    });
  });

  // Error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
      success: false,
      error: "server_error",
      message: "Something went wrong."
    });
  });

  const PORT = process.env.PORT || 10000;
  app.listen(PORT, () => {
    console.log(`iBand backend running on port ${PORT}`);
  });
}

start();