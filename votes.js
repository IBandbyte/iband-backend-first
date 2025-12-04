// votes.js
// Votes router for iBand backend (in-memory, DB-ready API shape)
//
// This module manages votes for artists using an in-memory store.
// It is intentionally simple for the current demo stack, but the
// routes are designed so we can later plug in a real database
// without changing the API contract.
//
// Vote shape:
// {
//   id: string,
//   artistId: string,
//   voterId: string | null,
//   createdAt: string (ISO)
// }

const express = require("express");
const router = express.Router();

// In-memory vote store
let nextVoteId = 1;
let votes = [];

/**
 * Compute totals per artistId
 * @returns {Array<{ artistId: string, count: number }>}
 */
function computeTotals() {
  const map = new Map();
  for (const v of votes) {
    const key = String(v.artistId);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries()).map(([artistId, count]) => ({
    artistId,
    count,
  }));
}

/**
 * Simple payload validation for creating a vote
 */
function validateVotePayload(body) {
  const errors = [];

  if (!body.artistId || typeof body.artistId !== "string") {
    errors.push("artistId is required and must be a string.");
  }

  if (
    typeof body.voterId !== "undefined" &&
    body.voterId !== null &&
    typeof body.voterId !== "string"
  ) {
    errors.push("voterId must be a string or null if provided.");
  }

  return errors;
}

/**
 * GET /api/votes
 * List all votes
 */
router.get("/", (req, res) => {
  try {
    res.json({
      success: true,
      count: votes.length,
      votes,
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
 * GET /api/votes/by-artist/:artistId
 * List votes for a specific artist
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
 * GET /api/votes/totals
 * Get total vote counts for all artists
 */
router.get("/totals", (req, res) => {
  try {
    const totals = computeTotals();
    res.json({
      success: true,
      totals,
    });
  } catch (error) {
    console.error("GET /api/votes/totals error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to compute vote totals.",
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
    const totals = computeTotals();
    const item = totals.find(
      (t) => String(t.artistId) === String(artistId)
    ) || { artistId: String(artistId), count: 0 };

    res.json({
      success: true,
      total: item,
    });
  } catch (error) {
    console.error("GET /api/votes/totals/:artistId error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to compute artist vote totals.",
    });
  }
});

/**
 * POST /api/votes
 * Create a new vote
 *
 * Body:
 * - artistId (string, required)
 * - voterId (string, optional) – used to prevent duplicate votes
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

    const { artistId, voterId = null } = req.body;

    // Optional: prevent duplicate votes by the same voter for the same artist
    if (voterId) {
      const existing = votes.find(
        (v) =>
          String(v.artistId) === String(artistId) &&
          String(v.voterId) === String(voterId)
      );
      if (existing) {
        return res.status(409).json({
          success: false,
          message:
            "Duplicate vote: this voter has already voted for this artist.",
        });
      }
    }

    const now = new Date().toISOString();
    const newVote = {
      id: String(nextVoteId++),
      artistId: String(artistId),
      voterId: voterId ? String(voterId) : null,
      createdAt: now,
    };

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
 * DELETE /api/votes/:id
 * Delete a single vote by its ID
 */
router.delete("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const index = votes.findIndex((v) => String(v.id) === String(id));

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
 * Delete all votes for a given artist
 */
router.delete("/by-artist/:artistId", (req, res) => {
  try {
    const { artistId } = req.params;
    const before = votes.length;
    votes = votes.filter(
      (v) => String(v.artistId) !== String(artistId)
    );
    const removedCount = before - votes.length;

    res.json({
      success: true,
      message: "Votes deleted for artist.",
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