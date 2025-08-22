// server.js — simple, working API with / and /artists
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// Use whichever you set on Render (we handle both just in case)
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// ----- Model -----
const Artist =
  mongoose.models.Artist ||
  mongoose.model(
    "Artist",
    new mongoose.Schema(
      {
        name: { type: String, required: true, trim: true },
        bio: { type: String, default: "" },
        imageUrl: { type: String, default: "" },
        votes: { type: Number, default: 0 },
      },
      { timestamps: true }
    )
  );

// ----- Routes -----

// Health check / homepage (so you don't see "Cannot GET /")
app.get("/", (_req, res) => {
  res.send("✅ iBand backend is running");
});

// GET /artists — list artists from MongoDB
app.get("/artists", async (_req, res) => {
  try {
    const list = await Artist.find(
      {},
      { name: 1, bio: 1, imageUrl: 1, votes: 1, createdAt: 1 }
    ).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----- Start server after DB connects -----
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ Mongo connection error:", err.message);
    process.exit(1);
  });