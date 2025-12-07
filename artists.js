const express = require("express");
const router = express.Router();
const db = require("./db");

const ADMIN_KEY = process.env.ADMIN_KEY || "mysecret123";

// ===========================================================
// Helper: Admin Key Check
// ===========================================================
function checkAdminKey(req, res) {
  const headerKey = req.headers["x-admin-key"];
  if (!headerKey || headerKey !== ADMIN_KEY) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid admin key.",
    });
  }
  return true;
}

// ===========================================================
// CREATE ARTIST (ADMIN)
// ===========================================================
router.post("/admin/artists/seed", async (req, res) => {
  if (!checkAdminKey(req, res)) return;

  try {
    const { name, genre, bio, imageUrl } = req.body;

    const result = await db.execute(
      "INSERT INTO artists (name, genre, bio, imageUrl) VALUES (?, ?, ?, ?)",
      [name, genre, bio, imageUrl]
    );

    res.status(201).json({
      success: true,
      artist: {
        id: result[0].insertId,
        name,
        genre,
        bio,
        imageUrl,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
});

// ===========================================================
// UPDATE ARTIST (ADMIN) — THIS IS THE ONE YOU NEED
// ===========================================================
router.put("/admin/artists/:id", async (req, res) => {
  if (!checkAdminKey(req, res)) return;

  try {
    const artistId = req.params.id;

    // Check if exists
    const [existing] = await db.execute(
      "SELECT * FROM artists WHERE id = ?",
      [artistId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Artist not found.",
      });
    }

    // Only update submitted fields
    const fields = [];
    const values = [];

    ["name", "genre", "bio", "imageUrl"].forEach((key) => {
      if (req.body[key]) {
        fields.push(`${key} = ?`);
        values.push(req.body[key]);
      }
    });

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update.",
      });
    }

    values.push(artistId);

    await db.execute(
      `UPDATE artists SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    return res.json({
      success: true,
      message: "Artist updated successfully.",
      updatedFields: req.body,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
});

// ===========================================================
// EXPORT ROUTER
// ===========================================================
module.exports = router;