// server.js
// iBand Backend — ES Module entrypoint (authoritative)

import express from "express";
import cors from "cors";

import artistsRouter from "./artists.js";
import votesRouter from "./votes.js";
import commentsRouter from "./comments.js";
import adminRouter from "./admin.js";
import eventsRouter from "./events.js";
import rankingRouter from "./ranking.js";
import recsRouter from "./recs.js";
import medalsRouter from "./medals.js";
import flashMedalsRouter from "./flashMedals.js"; // ✅ Phase E

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-key"],
  })
);

app.use(express.json({ limit: "1mb" }));

app.use((req, _res, next) => {
  req._rid = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  next();
});

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "iBand backend is running",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/artists", artistsRouter);
app.use("/api/votes", votesRouter);
app.use("/api/comments", commentsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/events", eventsRouter);
app.use("/api/ranking", rankingRouter);
app.use("/api/recs", recsRouter);

app.use("/api/medals", medalsRouter);
app.use("/api/flash-medals", flashMedalsRouter); // ✅ Phase E

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found.",
    path: req.originalUrl,
  });
});

app.use((err, req, res, _next) => {
  const code = Number(err?.status || err?.statusCode || 500);
  const safeCode = code >= 400 && code <= 599 ? code : 500;

  console.error("API_ERROR", {
    rid: req?._rid,
    method: req?.method,
    path: req?.originalUrl,
    message: err?.message,
  });

  res.status(safeCode).json({
    success: false,
    message: safeCode === 500 ? "Internal server error" : err?.message || "Error",
    rid: req?._rid,
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`iBand backend listening on port ${PORT}`);
  console.log("our service is live 🎉");
});

export default app;