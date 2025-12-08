// server.js
// Main iBand backend server

const express = require("express");
const cors = require("cors");

// Ensure DB is initialized (creates artists table if needed)
require("./db/init");

// Route modules
const votesRoutes = require("./routes/votes");
const safetyRoutes = require("./routes/safety");
const artistsRoutes = require("./routes/artists.fake"); // current public artists API (fake/mock)
const adminArtistsRoute = require("./routes/admin.artists"); // new admin CRUD for artists

const app = express();
const PORT = process.env.PORT || 10000;

// Global middleware
app.use(cors());
app.use(express.json());

// Health/root endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "iBand backend is live 🚀",
  });
});

// Public routes
app.use("/api/votes", votesRoutes);
app.use("/api/safety", safetyRoutes);
app.use("/api/artists", artistsRoutes);

// Admin routes
app.use("/api/admin/artists", adminArtistsRoute);

// 404 handler (must be after all routes)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found.",
    path: req.originalUrl,
  });
});

// Global error handler (last)
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`iBand backend listening on port ${PORT}`);
});

module.exports = app;