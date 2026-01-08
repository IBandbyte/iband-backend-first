// server.js (F2)
// iBand Backend - root-based layout (no /src)
// Public APIs: /api/artists, /api/votes, /api/comments
// Admin APIs:  /api/admin/*
// Health:      /health

const express = require("express");
const cors = require("cors");

const app = express();

// ---------- Middleware ----------
app.disable("x-powered-by");

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));

// simple request id
app.use((req, res, next) => {
  req.requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  res.setHeader("x-request-id", req.requestId);
  next();
});

// ---------- Health ----------
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "iBand backend is running",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ---------- Routes ----------
const artistsRouter = require("./artists");
const votesRouter = require("./votes");
const commentsRouter = require("./comments");
const adminRouter = require("./admin");

app.use("/api/artists", artistsRouter);
app.use("/api/votes", votesRouter);
app.use("/api/comments", commentsRouter);
app.use("/api/admin", adminRouter);

// ---------- 404 ----------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found.",
    path: req.originalUrl,
  });
});

// ---------- Error handler ----------
app.use((err, req, res, next) => {
  console.error("API_ERROR", {
    requestId: req.requestId,
    path: req.originalUrl,
    message: err?.message,
  });

  res.status(500).json({
    success: false,
    message: "Internal server error",
    requestId: req.requestId,
  });
});

// ---------- Start ----------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`iBand backend listening on port ${PORT}`);
  console.log("our service is live 🎉");
});

module.exports = app;