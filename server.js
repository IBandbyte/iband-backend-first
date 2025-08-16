const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB connection error:", err));

// Example schema/model
const artistSchema = new mongoose.Schema({
  name: String,
  genre: String,
  votes: { type: Number, default: 0 }
});

const Artist = mongoose.model("Artist", artistSchema);

// Routes
app.get("/", (req, res) => {
  res.send("🎸 iBand Backend is running!");
});

app.get("/artists", async (req, res) => {
  const artists = await Artist.find();
  res.json(artists);
});

app.post("/artists", async (req, res) => {
  const newArtist = new Artist(req.body);
  await newArtist.save();
  res.json(newArtist);
});

app.post("/artists/:id/vote", async (req, res) => {
  const artist = await Artist.findById(req.params.id);
  if (!artist) return res.status(404).send("Artist not found");
  artist.votes++;
  await artist.save();
  res.json(artist);
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));