// artists.js
// iBand backend - Artists router (in-memory store, DB-ready API shape)
//
// Artist structure:
// {
//   id: string,
//   name: string,
//   genre: string | null,
//   bio: string | null,
//   imageUrl: string | null,
//   votes: number,          // display-only for now (canonical votes live in votes.js)
//   commentsCount: number,  // display-only (canonical comments live in comments.js)
//   createdAt: string (ISO),
//   updatedAt: string (ISO)
// }

const express = require("express");
const router = express.Router();

// --- In-memory data store ----------------------------------------------------

const nowISO = () => new Date().toISOString();

let artists = [
  {
    id: "1",
    name: "Aria Nova",
    genre: "Pop",
    bio: "Rising star blending electro-pop with dreamy vocals.",
    imageUrl: "https://i.imgur.com/XYZ123a.jpg",
    votes: 0,
    commentsCount: 0,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  },
  {
    id: "2",
    name: "Neon Harbor",
    genre: "Synthwave",
    bio: "Retro-futuristic vibes, heavy synth, 80s nostalgia.",
    imageUrl: "https://i.imgur.com/XYZ123b.jpg",
    votes: 0,
    commentsCount: 0,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  },
  {
    id: "3",
    name: "Stone & Sparrow",
    genre: "Indie Folk",
    bio: "Acoustic harmonies, storytelling, and soulful strings.",
    imageUrl: "https://i.imgur.com/XYZ123c.jpg",
    votes: 0,
    commentsCount: 0,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  },
];

let nextArtistId = 4;

// --- Helpers -----------------------------------------------------------------

function validateArtistPayload(body, { requireName = true } = {}) {
  const errors = [];

  if (requireName) {
    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      errors.push("name is required and must be a non-empty string.");
    }
  } else if (typeof body.name !== "undefined") {
    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      errors.push("if provided, name must be a non-empty string.");
    }
  }

  if (typeof body.genre !== "undefined" && body.genre !== null) {
    if (typeof body.genre !== "string") {
      errors.push("genre must be a string if provided.");
    }
  }

  if (typeof body.bio !== "undefined" && body.bio !== null) {
    if (typeof body.bio !== "string") {
      errors.push("bio must be a string if provided.");
    }
  }

  if (typeof body.imageUrl !== "undefined" && body.imageUrl !== null) {
    if (typeof body.imageUrl !== "string") {
      errors.push("imageUrl must be a string if provided.");
    }
  }

  return errors;
}

function toPublicArtist(a) {
  // In case we later want to hide internal fields, this is the mapping point
  return a;
}

// --- Routes ------------------------------------------------------------------

/**
 * GET /api/artists
 * List all artists.
 */
router.get("/", (req, res) => {
  try {
    const mapped = artists.map(toPublicArtist);
    res.json({
      success: true,
      count: mapped.length,
      artists: mapped,
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
 * GET /api/artists/:id
 * Fetch a single artist by ID.
 */
router.get("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const artist = artists.find((a) => String(a.id) === String(id));

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist not found.",
      });
    }

    res.json({
      success: true,
      artist: toPublicArtist(artist),
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
 * Create a new artist.
 *
 * Body:
 * - name (string, required)
 * - genre (string, optional)
 * - bio (string, optional)
 * - imageUrl (string, optional)
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

    const { name, genre, bio, imageUrl } = req.body;
    const now = nowISO();

    const artist = {
      id: String(nextArtistId++),
      name: name.trim(),
      genre: genre ? String(genre).trim() : null,
      bio: bio ? String(bio).trim() : null,
      imageUrl: imageUrl ? String(imageUrl).trim() : null,
      votes: 0,
      commentsCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    artists.push(artist);

    res.status(201).json({
      success: true,
      message: "Artist created successfully.",
      artist: toPublicArtist(artist),
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
 * PATCH /api/artists/:id
 * Update an existing artist (partial update).
 *
 * Body (any subset):
 * - name (string, optional)
 * - genre (string, optional)
 * - bio (string, optional)
 * - imageUrl (string, optional)
 * - votes (number, optional)          // admin-only in future
 * - commentsCount (number, optional)  // admin-only in future
 */
router.patch("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const index = artists.findIndex((a) => String(a.id) === String(id));

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
    const patch = {};
    const now = nowISO();

    if (typeof req.body.name !== "undefined") {
      patch.name = req.body.name ? req.body.name.trim() : existing.name;
    }
    if (typeof req.body.genre !== "undefined") {
      patch.genre = req.body.genre ? String(req.body.genre).trim() : null;
    }
    if (typeof req.body.bio !== "undefined") {
      patch.bio = req.body.bio ? String(req.body.bio).trim() : null;
    }
    if (typeof req.body.imageUrl !== "undefined") {
      patch.imageUrl = req.body.imageUrl
        ? String(req.body.imageUrl).trim()
        : null;
    }

    if (typeof req.body.votes === "number") {
      patch.votes = req.body.votes;
    }
    if (typeof req.body.commentsCount === "number") {
      patch.commentsCount = req.body.commentsCount;
    }

    const updated = {
      ...existing,
      ...patch,
      updatedAt: now,
    };

    artists[index] = updated;

    res.json({
      success: true,
      message: "Artist updated successfully.",
      artist: toPublicArtist(updated),
    });
  } catch (error) {
    console.error("PATCH /api/artists/:id error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update artist.",
    });
  }
});

/**
 * DELETE /api/artists/:id
 * Delete a single artist.
 */
router.delete("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const index = artists.findIndex((a) => String(a.id) === String(id));

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
      artist: toPublicArtist(removed),
    });
  } catch (error) {
    console.error("DELETE /api/artists/:id error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete artist.",
    });
  }
});

/**
 * DELETE /api/artists
 * Danger: delete ALL artists.
 * (Useful for tests/admin; secured later via admin key.)
 */
router.delete("/", (req, res) => {
  try {
    const deletedCount = artists.length;
    artists = [];
    nextArtistId = 1;

    res.json({
      success: true,
      message: "All artists deleted.",
      deletedCount,
    });
  } catch (error) {
    console.error("DELETE /api/artists error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete artists.",
    });
  }
});

module.exports = router;