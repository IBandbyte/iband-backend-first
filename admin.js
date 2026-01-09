import express from "express";

import adminArtistsRouter from "./adminArtists.js";
import adminCommentsRouter from "./adminComments.js";

const router = express.Router();

/**
 * Admin root health
 * GET /api/admin
 */
router.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "iBand admin API is running.",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Ping endpoint
 * GET /api/admin/ping
 */
router.get("/ping", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "pong",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Info endpoint (lightweight)
 * GET /api/admin/info
 */
router.get("/info", (req, res) => {
  return res.status(200).json({
    success: true,
    env: {
      nodeVersion: process.version,
      platform: process.platform,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * Admin resources
 * /api/admin/artists/...
 * /api/admin/comments/...
 */
router.use("/artists", adminArtistsRouter);
router.use("/comments", adminCommentsRouter);

export default router;