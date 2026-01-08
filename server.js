// server.js
// iBand Backend — ES Module entrypoint (authoritative)

import express from "express";
import cors from "cors";

import artistsRouter from "./artists.js";
import votesRouter from "./votes.js";
import commentsRouter from "./comments.js";
import adminRouter from "./admin.js";

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

// ---------- Health ----------
app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "iBand backend is running",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ---------- Routes ----------
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
app.use((err, req, res, _next) => {
  console.error("API_ERROR", {
    path: req.originalUrl,
    message: err?.message,
  });

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// ---------- Start ----------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`iBand backend listening on port ${PORT}`);
  console.log("our service is live 🎉");
});

export default app;