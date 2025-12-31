// server.js (ESM)
import express from "express";
import cors from "cors";

import { artistsRouter } from "./artists.js";
import { commentsRouter } from "./comments.js";

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-key"],
  })
);

app.use(express.json({ limit: "1mb" }));

// ----------------------
// Health
// ----------------------
app.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    status: "ok",
    service: "iband-backend",
    ts: new Date().toISOString(),
  });
});

// ----------------------
// Core Routers
// ----------------------

// Artists
app.use("/artists", artistsRouter);

// Comments
app.use("/", commentsRouter);

// ----------------------
// Admin Routes (Phase 2.2.3)
// ESM-safe dynamic import, supports either:
// - export default function registerAdminArtists(app) {}
// - export function registerAdminArtists(app) {}
// - module.exports = function registerAdminArtists(app) {}  (via transpiled/default interop)
// ----------------------
try {
  const mod = await import("./adminArtists.js");

  const register =
    (mod && typeof mod.default === "function" && mod.default) ||
    (mod && typeof mod.registerAdminArtists === "function" && mod.registerAdminArtists) ||
    (mod && typeof mod.register === "function" && mod.register) ||
    null;

  if (typeof register === "function") {
    register(app);
    console.log("✅ Admin routes mounted: /admin/* and /api/admin/*");
  } else {
    console.warn(
      "⚠️ adminArtists.js loaded, but no valid register function export was found. Admin routes NOT mounted."
    );
  }
} catch (e) {
  console.warn("⚠️ Admin routes not mounted (adminArtists.js import failed):", e?.message || e);
}

// ----------------------
// Root
// ----------------------
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

      // Admin (Phase 2.2.3)
      adminArtists: "/admin/artists?status=pending",
      adminArtistById: "/admin/artists/:id",
      adminApprove: "/admin/artists/:id/approve",
      adminReject: "/admin/artists/:id/reject",
      adminRestore: "/admin/artists/:id/restore",
      adminDelete: "/admin/artists/:id",
      adminStats: "/admin/stats",

      // Alt prefix (same handlers)
      apiAdminArtists: "/api/admin/artists?status=pending",
      apiAdminStats: "/api/admin/stats",
    },
  });
});

// ----------------------
// 404 JSON
// ----------------------
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Not found" });
});

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`iBand backend listening on port ${port}`);
});