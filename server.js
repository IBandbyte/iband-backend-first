// server.js — iBand backend (clean, with root + artists + admin + health)

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// --- MongoDB ---
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is not set");
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  });

// --- Routes ---
const artistsRouter = require("./artists");
app.use("/artists", artistsRouter);

const adminRouter = require("./admin");
app.use("/admin", adminRouter);

// Root (for sanity check)
app.get("/", (_req, res) => {
  res.type("text/plain").send("✅ iBand backend is running");
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", message: "Backend is live!" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));