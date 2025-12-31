// server.js — iBand Backend (ESM-safe, Render-safe)

import express from "express";
import cors from "cors";
import { createRequire } from "module";

import { artistsRouter } from "./artists.js";
import { commentsRouter } from "./comments.js";

// 🔐 REQUIRED to load CommonJS modules inside ESM
const require = createRequire(import.meta.url);

// adminArtists.js is CommonJS (module.exports = fn)
const registerAdminArtists = require("./adminArtists.js");

const app = express();

// ----------------------
// Middleware
// ----------------------
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-key"],
  })
);

app.use(express.json({ limit: "1mb" }));

// ----------------------
// Health
// ----------------------
app.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    status: "ok",
    service: "iband-backend",
    ts: new Date().toISOString(),
  });
});

// ----------------------
// Core Routes
// ----------------------
app.use("/artists", artistsRouter);
app.use("/", commentsRouter);

// ----------------------
// Admin Routes (Phase 2.2.3)
// IMPORTANT: this MUST be mounted AFTER app creation
// ----------------------
registerAdminArtists(app);

// ----------------------
// Root Index
// ----------------------
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    service: "iband-backend",
    endpoints: {
      health: "/health",
      artists: "/artists",
      artistById: "/artists/:id",
      votes: "/artists/:id/votes",
      comments: "/artists/:id/comments",
      adminArtists: "/admin/artists",
      adminApprove: "/admin/artists/:id/approve",
      adminReject: "/admin/artists/:id/reject",
      adminRestore: "/admin/artists/:id/restore",
      adminStats: "/admin/stats",
    },
  });
});

// ----------------------
// 404 JSON (must be last)
// ----------------------
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Not found" });
});

// ----------------------
// Server
// ----------------------
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`🚀 iBand backend listening on port ${port}`);
});