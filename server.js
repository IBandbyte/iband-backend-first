// server.js
// iBand Backend — Phase 2.2.x
// ESM ONLY (package.json has "type": "module")

import express from "express";
import cors from "cors";

import { artistsRouter } from "./artists.js";
import { commentsRouter } from "./comments.js";

// adminArtists.js is CommonJS-style (module.exports = function)
// In ESM, import it and call it defensively.
import adminArtistsModule from "./adminArtists.js";

const app = express();

/* -----------------------------
   Global Middleware
-------------------------------- */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-key"],
  })
);

app.use(express.json({ limit: "1mb" }));

/* -----------------------------
   Health Check
-------------------------------- */
app.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    status: "ok",
    service: "iband-backend",
    ts: new Date().toISOString(),
  });
});

/* -----------------------------
   Core Routes
-------------------------------- */
app.use("/artists", artistsRouter);

// Comments (Phase 2.2.1)
app.use("/", commentsRouter);

/* -----------------------------
   Admin Routes (Phase 2.2.3)
-------------------------------- */
const registerAdminArtists =
  typeof adminArtistsModule === "function"
    ? adminArtistsModule
    : typeof adminArtistsModule?.default === "function"
      ? adminArtistsModule.default
      : null;

if (registerAdminArtists) {
  registerAdminArtists(app);
} else {
  console.warn("⚠️ adminArtists.js did not export a callable function (admin routes NOT mounted).");
}

/* -----------------------------
   Root Info
-------------------------------- */
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

      // Admin
      adminArtists: "/admin/artists",
      adminArtistById: "/admin/artists/:id",
      adminApprove: "/admin/artists/:id/approve",
      adminReject: "/admin/artists/:id/reject",
      adminRestore: "/admin/artists/:id/restore",
      adminDelete: "/admin/artists/:id",
      adminStats: "/admin/stats",
    },
  });
});

/* -----------------------------
   404 Handler
-------------------------------- */
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Not found" });
});

/* -----------------------------
   Boot Server
-------------------------------- */
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`🚀 iBand backend listening on port ${port}`);
});