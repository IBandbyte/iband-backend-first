// routes/admin.stats.js
// Admin-only stats for the iBand backend.
// Exposed under /api/admin/stats and /api/admin/stats/by-artist

const express = require("express");
const router = express.Router();

const ArtistsService = require("../services/artistsService");
const CommentsService = require("../services/commentsService");

// Simple admin-key guard (same as other admin routes)
function adminGuard(req, res, next) {
  const key = req.headers["x-admin-key"];

  if (key !== "mysecret123") {
    return res.status(403).json({
      success: false,
      message: "Invalid admin key.",
    });
  }

  next();
}

/**
 * GET /api/admin/stats
 * High-level totals:
 * - how many artists
 * - sum of all votes
 * - how many comments
 */
router.get("/", adminGuard, async (req, res) => {
  try {
    const artists = await ArtistsService.getAllArtists();
    const comments = await CommentsService.getAllComments();

    const artistCount = artists.length;
    const totalVotes = artists.reduce(
      (sum, artist) => sum + (Number(artist.votes) || 0),
      0
    );
    const commentCount = comments.length;

    return res.json({
      success: true,
      stats: {
        artistCount,
        totalVotes,
        commentCount,
      },
    });
  } catch (err) {
    console.error("Admin GET /stats error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin stats.",
    });
  }
});

/**
 * GET /api/admin/stats/by-artist
 * Per-artist breakdown so the dashboard can show:
 * - artist id
 * - name
 * - votes
 * - number of comments
 */
router.get("/by-artist", adminGuard, async (req, res) => {
  try {
    const artists = await ArtistsService.getAllArtists();
    const comments = await CommentsService.getAllComments();

    const breakdown = artists.map((artist) => {
      const rawId = artist.id ?? artist._id;
      const numericId =
        typeof rawId === "number" ? rawId : Number(rawId) || rawId;

      const commentCountForArtist = comments.filter(
        (c) => c.artistId === numericId
      ).length;

      return {
        id: rawId,
        name: artist.name,
        votes: Number(artist.votes) || 0,
        comments: commentCountForArtist,
      };
    });

    return res.json({
      success: true,
      count: breakdown.length,
      items: breakdown,
    });
  } catch (err) {
    console.error("Admin GET /stats/by-artist error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch per-artist stats.",
    });
  }
});

module.exports = router;