import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H49 Session Learning Engine
|--------------------------------------------------------------------------
| Tracks in-session behaviour and produces real-time adaptive
| learning signals such as mood, engagement state, genre drift,
| and feed adjustment recommendations.
|--------------------------------------------------------------------------
*/

const SESSION_STORE = new Map();

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function ensureSession(sessionId) {
  if (!SESSION_STORE.has(sessionId)) {
    SESSION_STORE.set(sessionId, {
      sessionId,
      events: [],
      counters: {
        watches: 0,
        skips: 0,
        replays: 0,
        likes: 0,
        shares: 0,
        saves: 0
      },
      preferredGenres: [],
      preferredCountries: [],
      mood: "neutral",
      engagementState: "warming_up",
      adaptationSignal: "observe",
      lastUpdatedAt: new Date().toISOString()
    });
  }

  return SESSION_STORE.get(sessionId);
}

function pushUniqueValue(list, value) {
  if (!value) return;
  if (!list.includes(value)) {
    list.push(value);
  }
}

function analyseSession(session) {
  const { watches, skips, replays, likes, shares, saves } = session.counters;

  const engagementScore =
    watches * 2 +
    replays * 3 +
    likes * 2 +
    shares * 3 +
    saves * 3 -
    skips * 2;

  let mood = "neutral";
  let engagementState = "warming_up";
  let adaptationSignal = "observe";

  if (engagementScore >= 18) {
    mood = "highly_engaged";
    engagementState = "locked_in";
    adaptationSignal = "push_more_similar";
  } else if (engagementScore >= 10) {
    mood = "engaged";
    engagementState = "growing";
    adaptationSignal = "continue_current_path";
  } else if (skips > watches) {
    mood = "bored";
    engagementState = "dropping";
    adaptationSignal = "inject_novelty";
  } else if (replays >= 2 || saves >= 1) {
    mood = "curious";
    engagementState = "building_interest";
    adaptationSignal = "deepen_category";
  }

  session.mood = mood;
  session.engagementState = engagementState;
  session.adaptationSignal = adaptationSignal;
  session.lastUpdatedAt = new Date().toISOString();

  return {
    engagementScore,
    mood,
    engagementState,
    adaptationSignal,
    counters: session.counters,
    preferredGenres: session.preferredGenres,
    preferredCountries: session.preferredCountries
  };
}

function getRandomSession() {
  const values = Array.from(SESSION_STORE.values());

  if (values.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * values.length);
  return values[index];
}

/*
|--------------------------------------------------------------------------
| GET /api/session-learning
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "H49 Session Learning Engine live.",
    count: SESSION_STORE.size,
    routes: [
      "/api/session-learning",
      "/api/session-learning/list",
      "/api/session-learning/random",
      "/api/session-learning/:sessionId"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/session-learning/list
|--------------------------------------------------------------------------
*/

router.get("/list", (req, res) => {
  return res.json({
    success: true,
    count: SESSION_STORE.size,
    sessions: Array.from(SESSION_STORE.values())
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/session-learning/random
|--------------------------------------------------------------------------
*/

router.get("/random", (req, res) => {
  return res.json({
    success: true,
    session: getRandomSession()
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/session-learning/:sessionId
|--------------------------------------------------------------------------
*/

router.get("/:sessionId", (req, res) => {
  const session = SESSION_STORE.get(req.params.sessionId);

  if (!session) {
    return res.status(404).json({
      success: false,
      message: "Session not found."
    });
  }

  return res.json({
    success: true,
    session
  });
});

/*
|--------------------------------------------------------------------------
| POST /api/session-learning
|--------------------------------------------------------------------------
| Records a behavioural event for a session.
|--------------------------------------------------------------------------
*/

router.post("/", (req, res) => {
  const { sessionId, eventType, genre, country, durationSec, meta } = req.body || {};

  if (!sessionId || !eventType) {
    return res.status(400).json({
      success: false,
      message: "sessionId and eventType are required."
    });
  }

  const allowedEventTypes = ["watch", "skip", "replay", "like", "share", "save"];

  if (!allowedEventTypes.includes(eventType)) {
    return res.status(400).json({
      success: false,
      message: "Unsupported eventType."
    });
  }

  const session = ensureSession(sessionId);

  session.events.push({
    eventType,
    genre: genre || null,
    country: country || null,
    durationSec: durationSec || 0,
    meta: meta || {},
    recordedAt: new Date().toISOString()
  });

  if (eventType === "watch") session.counters.watches += 1;
  if (eventType === "skip") session.counters.skips += 1;
  if (eventType === "replay") session.counters.replays += 1;
  if (eventType === "like") session.counters.likes += 1;
  if (eventType === "share") session.counters.shares += 1;
  if (eventType === "save") session.counters.saves += 1;

  pushUniqueValue(session.preferredGenres, genre);
  pushUniqueValue(session.preferredCountries, country);

  const analysis = analyseSession(session);

  return res.json({
    success: true,
    message: "Session event recorded.",
    sessionId,
    eventType,
    analysis
  });
});

export default router;