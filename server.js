// server.js
// Root Express server for the iBand backend (root-based layout)

const express = require("express");
const cors = require("cors");
const path = require("path");

// Routers (all in project root)
const artistsRouter = require("./artists");
const commentsRouter = require("./comments");
const votesRouter = require("./votes");
const adminRouter = require("./admin");

const app = express();

// Environment / config
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Simple request logger (safe for Render logs, helpful for debugging)
app.use((req, res, next) => {
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`
  );
  next();
});

// Health check endpoint for Render / uptime checks
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Serve a simple landing page if index.html exists in root
app.get("/", (req, res) => {
  const indexPath = path.join(__dirname, "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) {
      // Fallback JSON if index.html is missing or fails to send
      console.warn(
        "index.html not found or failed to send, falling back to JSON."
      );
      res.json({
        message: "iBand backend is running.",
        docs: {
          artists: "/api/artists",
          comments: "/api/comments",
          votes: "/api/votes",
          admin: "/api/admin",
          health: "/health",
        },
      });
    }
  });
});

// Mount core API routers
app.use("/api/artists", artistsRouter);
app.use("/api/comments", commentsRouter);
app.use("/api/votes", votesRouter);
app.use("/api/admin", adminRouter);

// 404 handler for unknown /api routes
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found.",
    path: req.originalUrl,
  });
});

// Global error handler (last middleware)
app.use((err, req, res, next) => {
  console.error("Unhandled error in server:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`iBand backend listening on port ${PORT}`);
});

// Export app for potential testing in the future
module.exports = app;