// routes/artists.js
const express = require("express");
const router = express.Router();
const Artists = require("../db/artists");

// GET all artists (public)
router.get("/", async (req, res) => {
  try {
    const artists = await Artists.getAll();
    res.json({ success: true, count: artists.length, artists });
  } catch (err) {
    console.error("Error fetching artists:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

// GET single artist by ID (public)
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const artist = await Artists.getById(id);

    if (!artist) {
      return res
        .status(404)
        .json({ success: false, message: "Artist not found." });
    }

    res.json({ success: true, artist });
  } catch (err) {
    console.error("Error fetching artist:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

module.exports = router;