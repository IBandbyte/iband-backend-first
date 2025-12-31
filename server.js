// server.js (root) — ESM
import express from "express";
import cors from "cors";

import { artistsRouter } from "./artists.js";
import { commentsRouter } from "./comments.js";
import registerAdminArtists from "./adminArtists.js";

const app = express();

// CORS (Hoppscotch + Vercel safe)
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-key"],
  })
);

app.use(express.json({ limit: "1mb" }));

// Health
app.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    status: "ok",
    service: "iband-backend",
    ts: new Date().toISOString(),
  });
});

// Artists
app.use("/artists", artistsRouter);

// Comments (Phase 2.2.1 uses /comments and /artists/:id/comments)
app.use("/", commentsRouter);

// Admin moderation (Phase 2.2.3)
registerAdminArtists(app);

// Root
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
      artistComments: "/artists/:id/comments",
      adminArtists: "/admin/artists",
      adminStats: "/admin/stats",
    },
  });
});

// 404 JSON
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Not found" });
});

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`iBand backend listening on port ${port}`);
});