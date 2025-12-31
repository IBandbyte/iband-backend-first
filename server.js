// server.js (ESM ONLY — no CommonJS)

import express from "express";
import cors from "cors";

import { artistsRouter } from "./artists.js";
import { commentsRouter } from "./comments.js";
import { registerAdminArtists } from "./adminArtists.js";

const app = express();

/* =========================
   Middleware
========================= */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-key"],
  })
);

app.use(express.json({ limit: "1mb" }));

/* =========================
   Health Check
========================= */
app.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    status: "ok",
    service: "iband-backend",
    ts: new Date().toISOString(),
  });
});

/* =========================
   Core Routes
========================= */
app.use("/artists", artistsRouter);
app.use("/", commentsRouter);

/* =========================
   Admin Routes (CRITICAL)
========================= */
registerAdminArtists(app);

/* =========================
   Root Info
========================= */
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    service: "iband-backend",
    endpoints: {
      health: "/health",
      artists: "/artists",
      artistById: "/artists/:id",
      votes: "/artists/:id/votes",
      comments: "/comments?artistId=:id",
      adminArtists: "/admin/artists",
      adminApprove: "/admin/artists/:id/approve",
      adminReject: "/admin/artists/:id/reject",
      adminStats: "/admin/stats",
    },
  });
});

/* =========================
   404 JSON (must be last)
========================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Not found",
  });
});

/* =========================
   Boot
========================= */
const port = process.env.PORT || 10000;

app.listen(port, () => {
  console.log(`🚀 iBand backend listening on port ${port}`);
});