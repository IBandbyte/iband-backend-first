// admin.js (ESM)
// Admin root router
// Mounted at /api/admin
//
// - Protects admin routes with x-admin-key if ADMIN_KEY is set
// - Mounts:
//   /api/admin/artists  -> adminArtists.js
//   /api/admin/comments -> adminComments.js

import express from "express";
import adminArtistsRouter from "./adminArtists.js";
import adminCommentsRouter from "./adminComments.js";

const router = express.Router();

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

// Mount admin routers
router.use("/artists", requireAdmin, adminArtistsRouter);
router.use("/comments", requireAdmin, adminCommentsRouter);

export default router;