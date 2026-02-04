// admin.js (ESM)
// Admin Router (authoritative)
// Mounted at: /api/admin
//
// Protects admin routes using x-admin-key header.
// If ADMIN_KEY is NOT set, it runs in "dev-open" mode (no auth) to avoid blocking testing.

import express from "express";

import adminArtistsRouter from "./adminArtists.js";
import adminCommentsRouter from "./adminComments.js";

const router = express.Router();

/* -------------------- Admin Key Guard -------------------- */

function safeText(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

router.use((req, res, next) => {
  const configuredKey = safeText(process.env.ADMIN_KEY);
  if (!configuredKey) {
    // Dev-open mode (no key configured)
    return next();
  }

  const provided = safeText(req.headers["x-admin-key"]);
  if (!provided || provided !== configuredKey) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized (missing or invalid x-admin-key).",
    });
  }

  next();
});

/* -------------------- Health -------------------- */

router.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "iBand admin API is running",
  });
});

/* -------------------- Routes -------------------- */

router.use("/artists", adminArtistsRouter);
router.use("/comments", adminCommentsRouter);

export default router;