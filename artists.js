// artists.js
// Artists router for iBand backend (in-memory store, root-based layout)

const express = require("express");
const router = express.Router();

/**
 * Artist structure (in-memory for now):
 * {
 *   id: string,
 *   name: string,
 *   genre: string | null,
 *   bio: string | null,
 *   imageUrl: string | null,
 *   createdAt: string (ISO),
 *   updatedAt: string (ISO),
 *   isFeatured: boolean
 * }
 *
 * NOTE:
 * - This is an in-memory store, so data resets when the server restarts.
 * - We can later swap this out for a real database without changing routes.
 */

// Seed a few demo artists so the frontend has something to show
let nextId = 1;

function createSeedArtist({ name, genre, bio, imageUrl, isFeatured = false }) {
  const now = new Date().toISOString();
  return {
    id: String(nextId++),
    name,
    genre: genre || null,
    bio: bio || null,
    imageUrl: imageUrl || null,
    createdAt: now,
    updatedAt: now,
    isFeatured: Boolean(isFeatured),
  };
}

let artists = [
  createSeedArtist({
    name: "Neon Echo",
    genre: "Synthwave",
    bio: "Unsigned producer blending retro synths with modern trap drums.",
    imageUrl: null,
    isFeatured: true,
  }),
  createSeedArtist({
    name: "Luna Verse",
    genre: "Alt Pop",
    bio: "DIY bedroom artist powered by TikTok loops and fan votes.",
    imageUrl: null,
  }),
  createSeedArtist({
    name: "Rogue Signal",
    genre: "Indie Rock",
    bio: "Glitchy guitars, big choruses, and festival energy.",
    imageUrl: null,
  }),
];

/**
 * Utility: find artist index by ID
 */
function findArtistIndex(id) {
  return artists.findIndex((a) => a.id === String(id));
}

/**
 * Utility: basic payload validation
 */
function validateArtistPayload(body, { requireName = true } = {}) {
  const errors = [];

  if (requireName && (!body.name || typeof body.name !== "string" || !body.name.trim())) {
    errors.push("name is required and must be a non-empty string.");
  }

  if (body.name && typeof body.name !== "string") {
    errors.push("name must be a string.");
  }

  if (body.genre && typeof body.genre !== "string") {
    errors.push("genre must be a string if provided.");
  }

  if (body.bio && typeof body.bio !== "string") {
    errors.push("bio must be a string if provided.");
  }

  if (body.imageUrl && typeof body.imageUrl !== "string") {
    errors.push("imageUrl must be a string if provided.");
  }

  if (
    typeof body.isFeatured !== "undefined" &&
    typeof body.isFeatured !== "boolean"
  ) {
    errors.push("isFeatured must be a boolean if provided.");
  }

  return errors;
}

/**
 * GET /api/artists
 * Optional query parameters:
 * - search: filter by name or genre (case-insensitive)
 * - genre: filter by exact genre
 * - featured: "true" or "false" to filter by isFeatured
 * - limit: max number of results
 */
router.get("/", (req, res) => {
  try {
    const { search, genre, featured, limit } = req.query;

    let result = [...artists];

    if (search && typeof search === "string") {
      const term = search.toLowerCase();
      result = result.filter(
        (a) =>
          (a.name && a.name.toLowerCase().includes(term)) ||
          (a.genre && a.genre.toLowerCase().includes(term))
      );
    }

    if (genre && typeof genre === "string") {
      result = result.filter(
        (a) => a.genre && a.genre.toLowerCase() === genre.toLowerCase()
      );
    }

    if (typeof featured !== "undefined") {
      const wantFeatured = String(featured).toLowerCase() === "true";
      result = result.filter((a) => a.isFeatured === wantFeatured);
    }

    let numericLimit = parseInt(limit, 10);
    if (!isNaN(numericLimit) && numericLimit > 0) {
      result = result.slice(0, numericLimit);
    }

    res.json({
      success: true,
      count: result.length,
      artists: result,
    });
  } catch (error) {
    console.error("GET /api/artists error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch artists.",
    });
  }
});

/**
 * GET /api/artists/featured
 * Convenience route to get only featured artists
 */
router.get("/featured", (req, res) => {
  try {
    const featuredArtists = artists.filter((a) => a.isFeatured);
    res.json({
      success: true,
      count: featuredArtists.length,
      artists: featuredArtists,
    });
  } catch (error) {
    console.error("GET /api/artists/featured error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch featured artists.",
    });
  }
});

/**
 * GET /api/artists/:id
 * Fetch a single artist by ID
 */
router.get("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const artist = artists.find((a) => a.id === String(id));

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist not found.",
      });
    }

    res.json({
      success: true,
      artist,
    });
  } catch (error) {
    console.error("GET /api/artists/:id error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch artist.",
    });
  }
});

/**
 * POST /api/artists
 * Create a new artist
 * Body:
 * - name (required)
 * - genre (optional)
 * - bio (optional)
 * - imageUrl (optional)
 * - isFeatured (optional boolean)
 */
router.post("/", (req, res) => {
  try {
    const errors = validateArtistPayload(req.body, { requireName: true });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid artist payload.",
        errors,
      });
    }

    const { name, genre, bio, imageUrl, isFeatured } = req.body;
    const now = new Date().toISOString();

    const newArtist = {
      id: String(nextId++),
      name: name.trim(),
      genre: genre ? genre.trim() : null,
      bio: bio ? bio.trim() : null,
      imageUrl: imageUrl ? imageUrl.trim() : null,
      createdAt: now,
      updatedAt: now,
      isFeatured: Boolean(isFeatured),
    };

    artists.push(newArtist);

    res.status(201).json({
      success: true,
      message: "Artist created successfully.",
      artist: newArtist,
    });
  } catch (error) {
    console.error("POST /api/artists error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create artist.",
    });
  }
});

/**
 * PUT /api/artists/:id
 * Replace an artist's fields
 * Body:
 * - name (required)
 * - genre (optional)
 * - bio (optional)
 * - imageUrl (optional)
 * - isFeatured (optional boolean)
 */
router.put("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const index = findArtistIndex(id);

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "Artist not found.",
      });
    }

    const errors = validateArtistPayload(req.body, { requireName: true });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid artist payload.",
        errors,
      });
    }

    const { name, genre, bio, imageUrl, isFeatured } = req.body;
    const now = new Date().toISOString();
    const existing = artists[index];

    const updated = {
      ...existing,
      name: name.trim(),
      genre: genre ? genre.trim() : null,
      bio: bio ? bio.trim() : null,
      imageUrl: imageUrl ? imageUrl.trim() : null,
      isFeatured: typeof isFeatured === "boolean" ? isFeatured : existing.isFeatured,
      updatedAt: now,
    };

    artists[index] = updated;

    res.json({
      success: true,
      message: "Artist updated successfully.",
      artist: updated,
    });
  } catch (error) {
    console.error("PUT /api/artists/:id error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update artist.",
    });
  }
});

/**
 * PATCH /api/artists/:id
 * Partially update an artist (any subset of fields)
 */
router.patch("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const index = findArtistIndex(id);

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "Artist not found.",
      });
    }

    const errors = validateArtistPayload(req.body, { requireName: false });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid artist payload.",
        errors,
      });
    }

    const existing = artists[index];
    const now = new Date().toISOString();
    const patch = {};

    if (typeof req.body.name !== "undefined") {
      patch.name = req.body.name.trim();
    }
    if (typeof req.body.genre !== "undefined") {
      patch.genre = req.body.genre ? req.body.genre.trim() : null;
    }
    if (typeof req.body.bio !== "undefined") {
      patch.bio = req.body.bio ? req.body.bio.trim() : null;
    }
    if (typeof req.body.imageUrl !== "undefined") {
      patch.imageUrl = req.body.imageUrl ? req.body.imageUrl.trim() : null;
    }
    if (typeof req.body.isFeatured !== "undefined") {
      patch.isFeatured = Boolean(req.body.isFeatured);
    }

    const updated = {
      ...existing,
      ...patch,
      updatedAt: now,
    };

    artists[index] = updated;

    res.json({
      success: true,
      message: "Artist patched successfully.",
      artist: updated,
    });
  } catch (error) {
    console.error("PATCH /api/artists/:id error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to patch artist.",
    });
  }
});

/**
 * DELETE /api/artists/:id
 * Remove an artist
 */
router.delete("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const index = findArtistIndex(id);

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "Artist not found.",
      });
    }

    const removed = artists.splice(index, 1)[0];

    res.json({
      success: true,
      message: "Artist deleted successfully.",
      artist: removed,
    });
  } catch (error) {
    console.error("DELETE /api/artists/:id error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete artist.",
    });
  }
});

module.exports = router;