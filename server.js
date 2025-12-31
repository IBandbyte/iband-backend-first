// server.js
import express from "express";
import cors from "cors";

import { artistsRouter } from "./artists.js";
import { commentsRouter } from "./comments.js";

// IMPORTANT: adminArtists must be ESM default export:
// export default function registerAdminArtists(app) { ... }
import registerAdminArtists from "./adminArtists.js";

const app = express();

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

// Admin moderation (Phase 2.2.3)
registerAdminArtists(app);

// Comments (Phase 2.2.1)
app.use("/", commentsRouter);

// Root
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    service: "iband-backend",
    endpoints: {
      health: "/health",

      // Artists
      artists: "/artists",
      artistById: "/artists/:id",
      votes: "/artists/:id/votes",

      // Comments
      comments: "/comments?artistId=:id",
      artistComments: "/artists/:id/comments",

      // Admin
      adminArtists: "/admin/artists",
      adminArtistById: "/admin/artists/:id",
      adminApprove: "/admin/artists/:id/approve",
      adminReject: "/admin/artists/:id/reject",
      adminRestore: "/admin/artists/:id/restore",
      adminDelete: "/admin/artists/:id",
      adminStats: "/admin/stats",
    },
    notes: {
      adminAuth:
        "If ADMIN_KEY is set on Render, send header x-admin-key: <ADMIN_KEY>. If not set, admin routes are open (dev mode).",
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