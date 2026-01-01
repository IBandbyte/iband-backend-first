// server.js (ESM ONLY — FINAL)

import express from "express";
import cors from "cors";

import { artistsRouter } from "./artists.js";
import { commentsRouter } from "./comments.js";
import { registerAdminArtists } from "./adminArtists.js";

const app = express();

/* -------------------- Middleware -------------------- */

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-key"],
  })
);

app.use(express.json({ limit: "1mb" }));

/* -------------------- Health -------------------- */

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "iband-backend",
    status: "ok",
    ts: new Date().toISOString(),
  });
});

/* -------------------- Core Routes -------------------- */

// Artists (public)
app.use("/artists", artistsRouter);

// Comments (Phase 2.2.1)
app.use("/", commentsRouter);

// Admin moderation (Phase 2.2.3)
registerAdminArtists(app);

/* -------------------- Root -------------------- */

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
      adminStats: "/admin/stats",
    },
  });
});

/* -------------------- 404 -------------------- */

app.use((req, res) => {
  res.status(404).json({ success: false, error: "Not found" });
});

/* -------------------- Boot -------------------- */

const port = process.env.PORT || 10000;

app.listen(port, () => {
  console.log(`🚀 iBand backend running on port ${port}`);
});