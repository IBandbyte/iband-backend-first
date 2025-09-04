// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Artist Schema
const artistSchema = new mongoose.Schema({
  name: String,
  genre: String,
});

const Artist = mongoose.model("Artist", artistSchema);

// Get all artists
app.get("/artists", async (req, res) => {
  try {
    const artists = await Artist.find();
    res.json(artists);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch artists" });
  }
});

// --- Admin Cleanup Route ---
app.post("/admin/cleanup", async (req, res) => {
  try {
    const key = req.headers["x-admin-key"];
    if (key !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const allArtists = await Artist.find({});
    const seen = new Set();
    let removed = 0;

    for (let artist of allArtists) {
      if (seen.has(artist.name)) {
        await Artist.deleteOne({ _id: artist._id });
        removed++;
      } else {
        seen.add(artist.name);
      }
    }

    res.json({ message: "Cleanup complete", removed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));