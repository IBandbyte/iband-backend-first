import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { artistsRouter } from "./artists.js";

const app = express();

/**
 * Core middleware
 */
app.set("trust proxy", 1);

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("tiny"));

/**
 * Health + root
 */
app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "iBand Backend",
    status: "ok",
    now: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "ok",
    service: "iband-backend",
    now: new Date().toISOString(),
  });
});

/**
 * Routes (mounted at BOTH root and /api for maximum compatibility)
 * Frontend calls /artists and /health
 * Admin or future clients can use /api/artists too
 */
app.use("/artists", artistsRouter);
app.use("/api/artists", artistsRouter);

/**
 * 404
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found.",
    path: req.originalUrl,
  });
});

/**
 * Error handler
 */
app.use((err, req, res, next) => {
  const status = Number(err?.status || 500);
  res.status(status).json({
    success: false,
    message: err?.message || "Internal server error",
    status,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`iBand backend listening on port ${PORT}`);
});