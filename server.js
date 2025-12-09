const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

// Initialise the in-memory "db" (logs: "iBand in-memory DB initialised (no sqlite).")
require("./db");

const safetyRoutes = require("./routes/safety");
const votesRoutes = require("./routes/votes");
const adminArtistsRoutes = require("./routes/admin.artists");
const publicArtistsRoutes = require("./routes/artists");

const app = express();
const PORT = process.env.PORT || 10000;

// Basic middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Root / health check
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "iBand backend is live",
  });
});

// Feature routes
app.use("/api/safety", safetyRoutes);
app.use("/api/votes", votesRoutes);
app.use("/api/admin/artists", adminArtistsRoutes);
// Public artists API (list + detail)
app.use("/api", publicArtistsRoutes);

// 404 handler (keep same shape as before)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found.",
    path: req.originalUrl,
  });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
});

app.listen(PORT, () => {
  console.log(`iBand backend listening on port ${PORT}`);
});

module.exports = app;