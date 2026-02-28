// server.js
// iBand Backend — Root Server (canonical)
// Captain’s Protocol: full file replacements only.

import express from "express";
import cors from "cors";

import votesRouter from "./votes.js";
import rankingRouter from "./ranking.js";
import medalsRouter from "./medals.js";
import recsRouter from "./recs.js";
import flashMedalsRouter from "./flashMedals.js";
import achievementsRouter from "./achievements.js";
import purchasesRouter from "./purchases.js";

const app = express();

const PORT = process.env.PORT || 10000;

// ---- Middleware ----
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ---- Health ----
app.get("/", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ---- Routers ----
app.use("/api/votes", votesRouter);
app.use("/api/ranking", rankingRouter);
app.use("/api/medals", medalsRouter);
app.use("/api/recs", recsRouter);
app.use("/api/flash-medals", flashMedalsRouter);
app.use("/api/achievements", achievementsRouter);

// Purchases / Commerce (alias)
app.use("/api/purchases", purchasesRouter);
app.use("/api/commerce", purchasesRouter);

// ---- 404 ----
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found.",
    path: req.originalUrl,
    updatedAt: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`iBand backend listening on port ${PORT}`);
  console.log("our service is live 🎉");
});