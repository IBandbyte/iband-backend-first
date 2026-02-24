// server.js
// iBand Backend — Captain’s Protocol
// Full canonical server with all routers mounted safely.
// Root layout: server.js and feature routers in repo root.

import express from "express";
import cors from "cors";

// Routers (root-level files)
import votesRouter from "./votes.js";
import rankingRouter from "./ranking.js";
import medalsRouter from "./medals.js";
import recsRouter from "./recs.js";
import flashMedalsRouter from "./flashMedals.js";
import achievementsRouter from "./achievements.js";

const app = express();

// -------------------------
// Core middleware
// -------------------------
app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// -------------------------
// Root health
// -------------------------
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "iband-backend",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/status", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// -------------------------
// API routers
// -------------------------
// Voting engine
app.use("/api/votes", votesRouter);

// Ranking engine
app.use("/api/ranking", rankingRouter);

// Medals engine (tiers / leaderboard / artist medal)
app.use("/api/medals", medalsRouter);

// Recs mix engine (feed mix + medals integrated)
app.use("/api/recs", recsRouter);

// Flash medals engine (24h badges + countdown + live feed)
app.use("/api/flash-medals", flashMedalsRouter);

// Achievements engine (persistent achievement log + queries)
app.use("/api/achievements", achievementsRouter);

// -------------------------
// 404 handler (API only)
// -------------------------
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found.",
    path: req.originalUrl,
    updatedAt: new Date().toISOString(),
  });
});

// -------------------------
// Start
// -------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`iBand backend listening on port ${PORT}`);
  console.log("our service is live 🎉");
});