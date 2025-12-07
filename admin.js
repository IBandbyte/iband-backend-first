// admin.js
// Root admin router: health, info, and sub-routes for comments + artists.

const express = require("express");
const router = express.Router();

const adminCommentsRouter = require("./adminComments");
const adminArtistsRouter = require("./adminArtists");

const ADMIN_KEY = process.env.ADMIN_KEY || "mysecret123";

function checkAdminKey(req, res, next) {
  const key = req.header("x-admin-key");
  if (!key || key !== ADMIN_KEY) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: invalid admin key."
    });
  }
  next();
}

// Basic admin root
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "iBand admin API is running."
  });
});

// Simple ping
router.get("/ping", (req, res) => {
  res.json({
    success: true,
    message: "pong",
    timestamp: new Date().toISOString()
  });
});

// Server env/info – protected
router.get("/info", checkAdminKey, (req, res) => {
  res.json({
    success: true,
    env: {
      nodeVersion: process.version,
      uptime: process.uptime()
    }
  });
});

// Mount sub-routers
router.use("/comments", adminCommentsRouter);
router.use("/artists", adminArtistsRouter);

module.exports = router;