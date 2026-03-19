// sessionLearning.js
const express = require("express");
const router = express.Router();

/**
 * H49 — Session Learning Engine
 * Real-time adaptive behaviour tracking per session
 */

// In-memory session store (upgrade later to Redis)
const sessions = new Map();

// Utility: create or get session
function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      id: sessionId,
      events: [],
      preferences: {},
      mood: "neutral",
      energy: 0,
      lastUpdated: new Date()
    });
  }
  return sessions.get(sessionId);
}

// Analyse session behaviour
function analyseSession(session) {
  let watchScore = 0;
  let skipScore = 0;
  let replayScore = 0;

  session.events.forEach(e => {
    if (e.type === "watch") watchScore += e.value || 1;
    if (e.type === "skip") skipScore += 1;
    if (e.type === "replay") replayScore += 2;
  });

  const engagement = watchScore + replayScore - skipScore;

  // Mood detection
  let mood = "neutral";
  if (engagement > 10) mood = "engaged";
  if (skipScore > watchScore) mood = "bored";

  session.mood = mood;
  session.energy = engagement;
  session.lastUpdated = new Date();

  return {
    engagement,
    mood,
    watchScore,
    skipScore,
    replayScore
  };
}

// POST — track event
router.post("/", (req, res) => {
  const { sessionId, type, value, meta } = req.body;

  if (!sessionId || !type) {
    return res.status(400).json({
      success: false,
      message: "sessionId and type required"
    });
  }

  const session = getSession(sessionId);

  session.events.push({
    type,
    value: value || 1,
    meta: meta || {},
    timestamp: new Date()
  });

  const analysis = analyseSession(session);

  res.json({
    success: true,
    message: "Session event recorded",
    sessionId,
    analysis
  });
});

// GET — full session state
router.get("/:sessionId", (req, res) => {
  const session = sessions.get(req.params.sessionId);

  if (!session) {
    return res.status(404).json({
      success: false,
      message: "Session not found"
    });
  }

  res.json({
    success: true,
    session
  });
});

// GET — list sessions
router.get("/list/all", (req, res) => {
  res.json({
    success: true,
    count: sessions.size,
    sessions: Array.from(sessions.values())
  });
});

// GET — random session
router.get("/random/one", (req, res) => {
  const all = Array.from(sessions.values());
  const random = all[Math.floor(Math.random() * all.length)];

  res.json({
    success: true,
    session: random || null
  });
});

module.exports = router;