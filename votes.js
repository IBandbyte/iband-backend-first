// votes.js
// Votes router for iBand backend
// Tracks fan votes for artists and exposes totals per artist

const express = require("express");
const router = express.Router();

/**
 * Vote structure (in-memory for now):
 * {
 *   id: string,
 *   artistId: string,
 *   voterId: string | null, // optional identifier to prevent duplicate votes
 *   createdAt: string (ISO)
 * }
 *
 * NOTES:
 * - This is an in-memory store so votes reset when the server restarts.
 * - Later we can replace this with a real database without changing
 *   the API surface.
 */

let votes = [];
let nextId = 1;

/**
 * Utility: create a new vote object
 */
function createVote({ artistId, voterId }) {
  const now = new Date().toISOString();

  return {
    id: String(nextId++),
    artistId: String(artistId),
    voterId: voterId ? String(voterId) : null,
    createdAt: now,
  };
}

/**
 * Utility: basic payload validation
 */
function validateVotePayload(body) {
  const errors = [];

  if (!body.artistId) {
    errors.push("artistId is required.");
  }

  if (
    body.artistId &&
    typeof body.artistId !== "string" &&
    typeof body.artistId !== "number"
  ) {
    errors.push("artistId must be a string or number.");
  }

  if (
    typeof body.voterId !== "undefined" &&
    body.voterId !== null &&
    typeof body.voterId !== "string" &&
    typeof body.voterId !== "number"
  ) {
    errors.push("voterId must be a string or number when provided.");
  }

  return errors;
}

/**
 * Utility: aggregate totals per artist
 */
function getVoteTotals(artistIdFilter) {
  const totalsMap = new Map();

  for (const vote of votes) {
    if (
      artistIdFilter &&
      String(vote.artistId) !== String(artistIdFilter)
    ) {
      continue;
    }

    const key = String(vote.artistId);
    const current = totalsMap.get(key) || 0;
    totalsMap.set(key, current + 1);
  }

  // Convert to an array sorted by count desc, then artistId asc
  const totalsArray = Array.from(totalsMap.entries())
    .map(([artistId, count]) => ({ artistId, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (a.artistId < b.artistId) return -1;
      if (a.artistId > b.artistId) return 1;
      return 0;
    });

  return totalsArray;
}

/**
 * GET /api/votes
 * Optional query parameters:
 * - artistId: filter by artist
 * - voterId: filter by voter
 * - limit: max number of entries to return
 */
router.get("/", (req, res) => {
  try {
    const { artistId, voterId, limit } = req.query;

    let result = votes;

    if (artistId) {
      result = result.filter(
        (v) => String(v.artistId) === String(artistId)
      );
    }

    if (voterId) {
      result = result.filter(
        (v) => String(v.voterId) === String(voterId)
      );
    }

    let numericLimit = parseInt(limit, 10);
    if (!isNaN(numericLimit) && numericLimit > 0) {
      result = result.slice(0, numericLimit);
    }

    res.json({
      success: true,
      count: result.length,
      votes: result,
    });
  } catch (error) {
    console.error("GET /api/votes error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch votes.",
    });
  }
});

/**
 * GET /api/votes/totals
 * Get total votes per artist
 */
router.get("/totals", (req, res) => {
  try {
    const totals = getVoteTotals();

    res.json({
      success: true,
      count: totals.length,
      totals,
    });
  } catch (error) {
    console.error("GET /api/votes/totals error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch vote totals.",
    });
  }
});

/**
 * GET /api/votes/totals/:artistId
 * Get total votes for a specific artist
 */
router.get("/totals/:artistId", (req, res) => {
  try {
    const { artistId } = req.params;
    const totals = getVoteTotals(artistId);
    const totalForArtist = totals.find(
      (entry) => String(entry.artistId) === String(artistId)
    );

    res.json({
      success: true,
      artistId: String(artistId),
      total: totalForArtist ? totalForArtist.count : 0,
    });
  } catch (error) {
    console.error("GET /api/votes/totals/:artistId error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch artist vote total.",
    });
  }
});

/**
 * GET /api/votes/by-artist/:artistId
 * Convenience route to fetch all votes for a given artist
 */
router.get("/by-artist/:artistId", (req, res) => {
  try {
    const { artistId } = req.params;

    const artistVotes = votes.filter(
      (v) => String(v.artistId) === String(artistId)
    );

    res.json({
      success: true,
      artistId: String(artistId),
      count: artistVotes.length,
      votes: artistVotes,
    });
  } catch (error) {
    console.error("GET /api/votes/by-artist/:artistId error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch artist votes.",
    });
  }
});

/**
 * GET /api/votes/:id
 * Fetch a single vote by its ID
 *
 * NOTE: This must come AFTER the other more specific GET routes
 * (like /totals and /by-artist) so it doesn't capture those paths.
 */
router.get("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const vote = votes.find((v) => v.id === String(id));

    if (!vote) {
      return res.status(404).json({
        success: false,
        message: "Vote not found.",
      });
    }

    res.json({
      success: true,
      vote,
    });
  } catch (error) {
    console.error("GET /api/votes/:id error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch vote.",
    });
  }
});

/**
 * POST /api/votes
 * Create a new vote for an artist
 * Body:
 * - artistId (required)
 * - voterId (optional but recommended for duplicate protection)
 *
 * If voterId is provided, we prevent that voter from voting more than
 * once for the same artist.
 */
router.post("/", (req, res) => {
  try {
    const errors = validateVotePayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid vote payload.",
        errors,
      });
    }

    const { artistId, voterId } = req.body;

    if (typeof voterId !== "undefined" && voterId !== null) {
      const duplicate = votes.find(
        (v) =>
          String(v.artistId) === String(artistId) &&
          String(v.voterId) === String(voterId)
      );

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message:
            "This voter has already voted for this artist. Duplicate vote blocked.",
        });
      }
    }

    const newVote = createVote({ artistId, voterId });
    votes.push(newVote);

    res.status(201).json({
      success: true,
      message: "Vote recorded successfully.",
      vote: newVote,
    });
  } catch (error) {
    console.error("POST /api/votes error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record vote.",
    });
  }
});

/**
 * PUT /api/votes/:id
 * We intentionally do NOT allow updating votes.
 * If a vote is wrong, the correct approach is to delete it and create a new one.
 */
router.put("/:id", (req, res) => {
  try {
    res.status(405).json({
      success: false,
      message:
        "Updating votes is not allowed. Delete and recreate the vote instead.",
    });
  } catch (error) {
    console.error("PUT /api/votes/:id error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process vote update request.",
    });
  }
});

/**
 * PATCH /api/votes/:id
 * Same rule as PUT: we don't support partial updates on votes.
 */
router.patch("/:id", (req, res) => {
  try {
    res.status(405).json({
      success: false,
      message:
        "Patching votes is not allowed. Delete and recreate the vote instead.",
    });
  } catch (error) {
    console.error("PATCH /api/votes/:id error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process vote patch request.",
    });
  }
});

/**
 * DELETE /api/votes/:id
 * Remove a single vote by ID
 */
router.delete("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const index = votes.findIndex((v) => v.id === String(id));

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "Vote not found.",
      });
    }

    const removed = votes.splice(index, 1)[0];

    res.json({
      success: true,
      message: "Vote deleted successfully.",
      vote: removed,
    });
  } catch (error) {
    console.error("DELETE /api/votes/:id error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete vote.",
    });
  }
});

/**
 * DELETE /api/votes/by-artist/:artistId
 * Remove all votes for a specific artist
 * (useful for admin tools or test resets)
 */
router.delete("/by-artist/:artistId", (req, res) => {
  try {
    const { artistId } = req.params;
    const beforeCount = votes.length;

    votes = votes.filter(
      (v) => String(v.artistId) !== String(artistId)
    );

    const removedCount = beforeCount - votes.length;

    res.json({
      success: true,
      message: "Votes for artist deleted successfully.",
      artistId: String(artistId),
      removedCount,
    });
  } catch (error) {
    console.error("DELETE /api/votes/by-artist/:artistId error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete artist votes.",
    });
  }
});

module.exports = router;