// artists.js (ESM)
// Public artists API

import express from "express";
import artistsStore from "./artistsStore.js";

const router = express.Router();

/**
 * GET /api/artists
 * List all artists
 */
router.get("/", (req, res) => {
  const artists = artistsStore.getAll();
  return res.status(200).json({
    success: true,
    count: artists.length,
    artists,
  });
});

/**
 * GET /api/artists/:id
 * Get single artist
 */
router.get("/:id", (req, res) => {
  const artist = artistsStore.getById(req.params.id);
  if (!artist) {
    return res.status(404).json({
      success: false,
      message: "Artist not found.",
    });
  }

  return res.status(200).json({
    success: true,
    artist,
  });
});

export default router;