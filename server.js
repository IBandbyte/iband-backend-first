/**
 * server.js (root-level backend)
 * ------------------------------
 * Future-proof Express server for iBand (Render)
 * - Safe-load route modules (won't crash if a module is missing)
 * - Production-ready middleware, logging, error handling
 */

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

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

// Body parsing (keep modest for iPhone testing + safety)
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

// Safe-load helper (prevents server crash if a file is missing)
function mountIfExists({ file, mountPath }) {
  try {
    const full = path.join(__dirname, file);
    if (!fs.existsSync(full)) {
      console.warn(`Route module missing: ${file} (skipped)`);
      return;
    }
    const mod = require(full);
    if (typeof mod !== "function") {
      console.warn(`Route module invalid (not a router): ${file} (skipped)`);
      return;
    }
    app.use(mountPath, mod);
    console.log(`Mounted ${file} at ${mountPath}`);
  } catch (err) {
    console.error(`Failed to mount ${file} at ${mountPath}`, err);
  }
}

// ------------------------------
// Mount existing iBand systems (root-level files)
// ------------------------------
mountIfExists({ file: "votes.js", mountPath: "/api/votes" });
mountIfExists({ file: "ranking.js", mountPath: "/api/ranking" });
mountIfExists({ file: "medals.js", mountPath: "/api/medals" });
mountIfExists({ file: "recs.js", mountPath: "/api/recs" });

mountIfExists({ file: "flashMedals.js", mountPath: "/api/flash-medals" });
mountIfExists({ file: "achievements.js", mountPath: "/api/achievements" });

mountIfExists({ file: "purchases.js", mountPath: "/api/purchases" });

// Phase H3: Monetisation Signals Engine
mountIfExists({ file: "monetisationSignals.js", mountPath: "/api/monetisation" });

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