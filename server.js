// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

// --- Middleware
app.use(cors());
app.use(express.json());

// --- Connect to MongoDB
(async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("❌ MONGO_URI is not set in environment");
    }
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
  }
})();

// --- Models
const Artist = require("./models/artist");

// --- Basic health check (root)
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "iBandbyte backend" });
});

// --- Public API
app.get("/artists", async (_req, res) => {
  try {
    const artists = await Artist.find();
    res.json(artists);
  } catch (err) {
    console.error("GET /artists failed:", err.message);
    res.status(500).json({ error: "Failed to fetch artists" });
  }
});

// --- Admin routes (require x-admin-key)
const adminRoutes = require("./admin");
app.use("/admin", adminRoutes);

// --- Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);