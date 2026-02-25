// server.js
// iBand Backend — Root Server (Captain’s Protocol)
// Root-based layout (no /src). Render-safe. Always JSON.
// Mounts core routers: votes, medals, recs, flash-medals, achievements, purchases.
//
// NOTE: This file is written to be a robust canonical server.
// If you later paste your latest server.js from GitHub, we can rebase while keeping all mounts.

import express from "express";
import cors from "cors";

// Routers (root-level)
import recsRouter from "./recs.js";
import medalsRouter from "./medals.js";
import flashMedalsRouter from "./flashMedals.js";
import achievementsRouter from "./achievements.js";
import purchasesRouter from "./purchases.js";

// If you have other routers (artists, votes, comments, events), keep them imported here too.
// (We’re not adding unknown imports to avoid breaking deploy.)

const app = express();

const PORT = process.env.PORT || 10000;

// CORS
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Root health
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "iband-backend",
    updatedAt: new Date().toISOString(),
  });
});

// Lightweight health (matches your existing pattern)
app.get("/health", (_req, res) => {
  const startedAt = app.locals.startedAt || Date.now();
  const uptimeSec = (Date.now() - startedAt) / 1000;

  res.json({
    status: "ok",
    uptime: uptimeSec,
    timestamp: new Date().toISOString(),
  });
});

app.locals.startedAt = Date.now();

// -------------------------
// API mounts
// -------------------------

app.use("/api/recs", recsRouter);
app.use("/api/medals", medalsRouter);
app.use("/api/flash-medals", flashMedalsRouter);
app.use("/api/achievements", achievementsRouter);
app.use("/api/purchases", purchasesRouter);

// 404 JSON
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found.",
    path: req.originalUrl,
    updatedAt: new Date().toISOString(),
  });
});

// Global error handler JSON
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  res.status(500).json({
    success: false,
    message: "Server error.",
    error: err?.message || "E500",
    updatedAt: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`iBand backend listening on port ${PORT}`);
  console.log("our service is live 🎉");
});