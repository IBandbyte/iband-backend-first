// server.js — iBandbyte backend (single-file entry)
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Health checks
app.get("/", (_req, res) => res.send("✅ iBandbyte backend is running"));
app.get("/health", (_req, res) => res.json({ ok: true, service: "iBandbyte" }));

// --- MongoDB connection ---
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err.message));

// --- Routes (kept in your flat layout) ---
app.use("/artists", require("./artists"));
app.use("/admin", require("./admin"));
// (comments.js and votes.js can stay as they are or be wired later)

// --- Start server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on :${PORT}`));