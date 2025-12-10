require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");

// Ensure in-memory DB is initialised
require("./db");

const artistsRouter = require("./routes/artists");
const adminArtistsRouter = require("./routes/admin.artists");
const votesRouter = require("./routes/votes");
const safetyRouter = require("./routes/safety");
const commentsRouter = require("./comments");
const adminCommentsRouter = require("./adminComments");

const app = express();

// ===== Middlewares =====
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(
  cors({
    origin: "*", // can be restricted later when frontend domain is fixed
  })
);

app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("tiny"));

// ===== Health check / root =====
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "iBand backend",
    time: new Date().toISOString(),
  });
});

// ===== Public routes =====
app.use("/api/artists", artistsRouter);
app.use("/api/votes", votesRouter);
app.use("/api/comments", commentsRouter);
app.use("/api/safety", safetyRouter);

// ===== Admin routes =====
app.use("/api/admin/artists", adminArtistsRouter);
app.use("/api/admin/comments", adminCommentsRouter);

// ===== 404 handler =====
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found.",
    path: req.originalUrl,
  });
});

// ===== Global error handler =====
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res
    .status(500)
    .json({ success: false, message: "Internal server error." });
});

// ===== Start server =====
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("iBand in-memory DB initialised.");
  console.log(`iBand backend listening on port ${PORT}`);
});

module.exports = app;