// admin.js (ESM)
// Admin root router
// Mounted at /api/admin
//
// Responsibilities:
// - Admin auth gate (x-admin-key)
// - Health / root
// - Mount admin sub-routers cleanly

import express from "express";
import adminArtistsRouter from "./adminArtists.js";
import adminCommentsRouter from "./adminComments.js";

const router = express.Router();

/* -------------------- Admin Auth -------------------- */

const ADMIN_KEY = (process.env.ADMIN_KEY || "").trim();

function requireAdmin(req, res, next) {
  // Dev-friendly: allow if no key configured
  if (!ADMIN_KEY) return next();

  const key = String(req.headers["x-admin-key"] || "").trim();
  if (!key || key !== ADMIN_KEY) {
    return res.status(403).json({
      success: false,
      message: "Forbidden (bad or missing x-admin-key)",
    });
  }
  next();
}

/* -------------------- Admin Root -------------------- */

/**
 * GET /api/admin
 */
router.get("/", requireAdmin, (_req, res) => {
  res.json({
    success: true,
    message: "iBand admin API is running.",
    routes: {
      artists: "/api/admin/artists",
      comments: "/api/admin/comments",
    },
  });
});

/* -------------------- Sub-routes -------------------- */

// IMPORTANT:
// - artists mounted at /api/admin/artists
// - comments mounted at /api/admin/comments
// - NOT mounted at "/" to avoid route collisions

router.use("/artists", requireAdmin, adminArtistsRouter);
router.use("/comments", requireAdmin, adminCommentsRouter);

export default router;