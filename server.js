// server.js — clean, working version

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// ----- Middleware
app.use(cors());
app.use(express.json());

// ----- Env
const PORT = process.env.PORT || 10000;
const MONGODB_URI = process.env.MONGODB_URI;

// ----- Mongoose model (re-use if already compiled)
const Artist =
  mongoose.models.Artist ||
  mongoose.model(
    "Artist",
    new mongoose.Schema(
      {
        name: { type: String, required: true },
        bio: { type: String, default: "" },
        imageUrl: { type: String, default: "" },
        votes: { type: Number, default: 0 },
      },
      { timestamps: true }
    )
  );

// ----- Routes

// Health / landing route (prevents "Cannot GET /")
app.get("/", (_req, res) => {
  res.status(200).send("✅ Backend is running!");
});

// List artists
app.get("/artists", async (_req, res) => {
  try {
    const all = await Artist.find().sort({ createdAt: -1 });
    res.json(all);
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// (Optional) admin router if you keep it in routes/admin.js
// const adminRouter = require("./routes/admin");
// app.use("/admin", adminRouter);

// ----- Start
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  });