/**
 * server.js - iBand backend (ESM)
 * Root-level project layout (no /src)
 *
 * Mounts:
 * - /api/votes
 * - /api/ranking
 * - /api/medals
 * - /api/recs
 * - /api/flashMedals
 * - /api/achievements
 * - /api/purchases
 * - /api/monetisation
 * - /api/shares   (Phase H4)
 */

import express from "express";
import cors from "cors";

import votesRouter from "./votes.js";
import rankingRouter from "./ranking.js";
import medalsRouter from "./medals.js";
import recsRouter from "./recs.js";
import flashMedalsRouter from "./flashMedals.js";
import achievementsRouter from "./achievements.js";
import purchasesRouter from "./purchases.js";
import monetisationRouter from "./monetisationSignals.js";
import sharesRouter from "./shares.js";

const app = express();

// ----------------------------
// Core middleware
// ----------------------------
app.use(cors());
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: true }));

// ----------------------------
// Health / root
// ----------------------------
app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "iband-backend",
    status: "ok",
    updatedAt: new Date().toISOString()
  });
});

// ----------------------------
// API routers
// ----------------------------
app.use("/api/votes", votesRouter);
app.use("/api/ranking", rankingRouter);
app.use("/api/medals", medalsRouter);
app.use("/api/recs", recsRouter);
app.use("/api/flashMedals", flashMedalsRouter);
app.use("/api/achievements", achievementsRouter);
app.use("/api/purchases", purchasesRouter);
app.use("/api/monetisation", monetisationRouter);
app.use("/api/shares", sharesRouter);

// ----------------------------
// 404
// ----------------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "not_found",
    path: req.originalUrl
  });
});

// ----------------------------
// Start
// ----------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`iBand backend listening on port ${PORT}`);
});