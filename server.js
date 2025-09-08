// server.js — iBand backend with extended artist schema + seed

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// --- MongoDB Connection ---
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// --- Artist Schema ---
const artistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    genre: { type: String, default: "No genre set" },
    bio: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    votes: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Artist = mongoose.models.Artist || mongoose.model("Artist", artistSchema);

// --- Routes ---
// Health check
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "iBand backend" });
});

// Get all artists
app.get("/artists", async (_req, res) => {
  try {
    const artists = await Artist.find().sort({ name: 1 });
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
      const norm = (artist.name || "").trim().toLowerCase();
      if (seen.has(norm)) {
        await Artist.deleteOne({ _id: artist._id });
        removed++;
      } else {
        seen.add(norm);
      }
    }

    res.json({ message: "Cleanup complete", removed });
  } catch (err) {
    console.error("❌ Cleanup failed:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Seed Route (for testing/demo) ---
app.post("/admin/seed", async (req, res) => {
  try {
    const key = req.headers["x-admin-key"];
    if (key !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const demoArtists = [
      {
        name: "Aria Nova",
        genre: "Pop",
        bio: "Rising star blending electro-pop with dreamy vocals.",
        imageUrl: "https://i.imgur.com/XYZ123a.jpg",
        votes: 12,
        commentsCount: 3,
      },
      {
        name: "Neon Harbor",
        genre: "Synthwave",
        bio: "Retro-futuristic vibes, heavy synth, 80s nostalgia.",
        imageUrl: "https://i.imgur.com/XYZ123b.jpg",
        votes: 8,
        commentsCount: 1,
      },
      {
        name: "Stone & Sparrow",
        genre: "Indie Folk",
        bio: "Acoustic harmonies, storytelling, and soulful strings.",
        imageUrl: "https://i.imgur.com/XYZ123c.jpg",
        votes: 20,
        commentsCount: 5,
      },
    ];

    await Artist.insertMany(demoArtists);
    res.json({ message: "✅ Demo artists seeded", count: demoArtists.length });
  } catch (err) {
    console.error("❌ Seeding failed:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Start server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));