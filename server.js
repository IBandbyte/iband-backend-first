// server.js
require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const cors = require("cors");

const artistsRoutes = require("./routes/artists");
const adminArtistsRoutes = require("./routes/admin.artists");
const votesRoutes = require("./routes/votes");
const commentsRoutes = require("./routes/comments");
const adminCommentsRoutes = require("./routes/admin.comments");
const safetyRoutes = require("./routes/safety");
const adminStatsRoutes = require("./routes/admin.stats");

const app = express();
const PORT = process.env.PORT || 10000;

// Simple log so we always know what mode we're in
console.info("iBand in-memory DB initialised (no sqlite).");

// --- Global middleware stack ---
app.use(helmet());
app.use(compression());

app.use(
  cors({
    origin: "*", // can be restricted later (e.g. https://ibandbyte.com)
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-key"],
  })
);

app.use(express.json());
app.use(morgan("tiny"));

// --- Health / root check ---
app.get("/", (req, res) => {
  return res.json({
    status: "ok",
    service: "iBand backend",
    time: new Date().toISOString(),
  });
});

// --- Public routes ---
app.use("/api/artists", artistsRoutes);
app.use("/api/votes", votesRoutes);
app.use("/api/comments", commentsRoutes);

// --- Admin routes ---
app.use("/api/admin/artists", adminArtistsRoutes);
app.use("/api/admin/comments", adminCommentsRoutes);
app.use("/api/admin/stats", adminStatsRoutes);

// --- Safety / diagnostics routes ---
app.use("/api/safety", safetyRoutes);

// --- 404 handler (must be after all routes) ---
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Route not found.",
    method: req.method,
    path: req.originalUrl || req.url,
  });
});

// --- Global error handler (Express will pass errors here) ---
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  return res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`iBand backend listening on port ${PORT}`);
});