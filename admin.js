// admin.js
// Simple admin router for iBand backend
// NOTE: This version is standalone and does NOT depend on any "models".
// It is designed to avoid startup crashes and provide basic diagnostics.

const express = require("express");
const router = express.Router();

// Basic admin home endpoint
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "iBand admin API is running.",
    docs: {
      ping: "/api/admin/ping",
      info: "/api/admin/info",
    },
  });
});

// Simple ping endpoint (for monitoring / debugging)
router.get("/ping", (req, res) => {
  res.json({
    success: true,
    message: "pong",
    timestamp: new Date().toISOString(),
  });
});

// Basic info endpoint (no deep coupling to other routers)
router.get("/info", (req, res) => {
  res.json({
    success: true,
    env: {
      nodeVersion: process.version,
      uptime: process.uptime(),
      platform: process.platform,
    },
  });
});

module.exports = router;