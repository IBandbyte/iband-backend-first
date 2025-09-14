// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// --- Mongo ---
const MONGO = process.env.MONGO_URI || process.env.MONGODB_URI;
mongoose
  .connect(MONGO)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err.message));

// --- Routes ---
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    mongoUriPresent: Boolean(MONGO),
    env: process.env.RENDER ? "render" : "local",
  });
});

app.use("/artists", require("./artists"));
app.use("/admin", require("./admin"));

app.get("/", (_req, res) => res.json({ ok: true, service: "iband-backend" }));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on :${PORT}`));