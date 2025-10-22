const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// --- config ---
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI; // already present on Render

// --- middleware ---
app.use(cors());
app.use(express.json());

// --- connect mongo once at boot ---
mongoose
  .connect(MONGO_URI, { dbName: process.env.MONGO_DB || "iband" })
  .then(() => console.log("Mongo connected"))
  .catch((e) => {
    console.error("Mongo connection error", e);
    process.exit(1);
  });

// --- health for whole service ---
app.get("/health", (_req, res) =>
  res.json({
    ok: true,
    service: "iband-backend",
    mongoUriPresent: !!MONGO_URI,
    env: process.env.RENDER ? "render" : "local",
  })
);

// --- existing routes ---
app.use("/artists", require("./routes/artists.fake")); // your current file
app.use("/vote", require("./routes/votes"));           // your current file
app.use("/admin", require("./routes/safety"));         // your current file

// --- NEW comments route ---
app.use("/comments", require("./comments"));           // <— add this line

// --- start ---
app.listen(PORT, () => console.log(`API listening on :${PORT}`));