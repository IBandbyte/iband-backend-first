// routes/admin.stats.js
// Admin-only stats endpoint for dashboard-style overviews.
//
// URL base: /api/admin/stats
// Currently returns totals for artists, votes and comments,
// plus a per-artist summary. Designed to be easy for the
// frontend dashboard to consume.

const express = require("express");
const router = express.Router();

const ArtistsService = require("../services/artistsService");
const CommentsService = require("../services/commentsService");

// --- Simple admin-key guard (same as admin.artists.js & admin.comments.js) ---
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

// --- GET /api/admin/stats ---
// High-level summary for dashboards and admin panels.
router.get("/", adminGuard, async (req, res) => {
  try {
    // Artists & votes
    const artists =
      (await ArtistsService.getAllArtists()) || [];

    const totalArtists = artists.length;
    const totalVotes = artists.reduce(
      (sum, artist) => sum + (Number(artist.votes) || 0),
      0
    );

    // Comments (use the CommentsService so we don't duplicate logic)
    let totalComments = 0;
    let allComments = [];

    if (
      CommentsService &&
      typeof CommentsService.getAllComments === "function"
    ) {
      allComments = (await CommentsService.getAllComments()) || [];
      totalComments = allComments.length;
    }

    // Per-artist summary (id, name, votes, optional comment count)
    const commentsByArtist = {};
    for (const comment of allComments) {
      const artistId = comment.artistId;
      if (!commentsByArtist[artistId]) {
        commentsByArtist[artistId] = 0;
      }
      commentsByArtist[artistId] += 1;
    }

    const artistSummaries = artists.map((artist) => {
      const artistId = artist.id || artist._id;
      const commentsCount = commentsByArtist[artistId] || 0;

      return {
        id: artistId,
        name: artist.name,
        genre: artist.genre,
        votes: Number(artist.votes) || 0,
        commentsCount,
      };
    });

    return res.json({
      success: true,
      stats: {
        totalArtists,
        totalVotes,
        totalComments,
        artists: artistSummaries,
      },
    });
  } catch (err) {
    console.error("Admin GET /api/admin/stats error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

module.exports = router;