// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// --- tiny health check so /health works
app.get("/health", (_req, res) => {
  res.json({ ok: true, mongoUriPresent: !!process.env.MONGO_URI, env: "render" });
});

// --- connect to MongoDB using MONGO_URI
(async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("❌ MONGO_URI is missing!");
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
  }
})();

// --- routes
const artistsRoute = require("./artists"); // lists artists
const adminRoute = require("./admin");     // protected admin tools

app.use("/artists", artistsRoute);
app.use("/admin", adminRoute);

// --- fallback
app.get("/", (_req, res) => res.send("iBand backend is running"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on :${PORT}`));