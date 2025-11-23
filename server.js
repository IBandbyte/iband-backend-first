// server.js (FULL FILE)

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// IMPORT ROUTES FROM THE CORRECT LOCATIONS
const artistRoutes = require("./src/artistRoutes");
const commentRoutes = require("./src/comments");
const voteRoutes = require("./src/votes");

// MOUNT ROUTES
app.use("/artists", artistRoutes);
app.use("/comments", commentRoutes);
app.use("/votes", voteRoutes);

// ROOT MESSAGE
app.get("/", (req, res) => {
  res.send("iBand Backend is running!");
});

// CONNECT TO MONGO
const mongoURI = process.env.MONGODB_URI;

console.log("Connecting to MongoDB...");

mongoose
  .connect(mongoURI)
  .then(() => {
    console.log("✅ MongoDB connected");
    const PORT = process.env.PORT || 10000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on :${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });