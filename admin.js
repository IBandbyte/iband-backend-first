// admin.js (ESM)
// Admin router
// Mounts admin sub-routers under /api/admin/*
//
// Requires x-admin-key header if ADMIN_KEY is set

import express from "express";

import adminArtistsRouter from "./adminArtists.js";
import adminCommentsRouter from "./adminComments.js";

const router = express.Router();

const ADMIN_KEY = (process.env.ADMIN_KEY || "").trim();

function requireAdmin(req, res, next) {
  // If no admin key is configured, allow (dev-friendly)
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

// Admin root
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

// Mount: /api/admin/artists/*
router.use("/artists", requireAdmin, adminArtistsRouter);

// ✅ CRITICAL: Mount: /api/admin/comments/*
router.use("/comments", requireAdmin, adminCommentsRouter);

export default router;