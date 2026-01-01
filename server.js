// server.js (ESM ONLY)

import express from "express";
import cors from "cors";

import { artistsRouter } from "./artists.js";
import { commentsRouter } from "./comments.js";
import { registerAdminArtists } from "./adminArtists.js";

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-key"],
  })
);

app.use(express.json());

// Health
app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "ok",
    service: "iband-backend",
    ts: new Date().toISOString(),
  });
});

// Core routes
app.use("/artists", artistsRouter);
app.use("/", commentsRouter);

// ✅ ADMIN ROUTES MOUNTED HERE
registerAdminArtists(app);

// Root
app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "iband-backend",
    endpoints: {
      health: "/health",
      artists: "/artists",
      adminArtists: "/admin/artists",
      adminStats: "/admin/stats",
    },
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Not found" });
});

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`🚀 iBand backend running on port ${port}`);
});