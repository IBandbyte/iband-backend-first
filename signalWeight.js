import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Signal Weight Table
|--------------------------------------------------------------------------
*/

const SIGNAL_WEIGHTS = {
  play: 1,
  vote: 2,
  comment: 2,
  share: 3,
  follow: 3,
  livestream_join: 4,
  purchase: 5,
  celebrity_join: 10
};

/*
|--------------------------------------------------------------------------
| Internal Store
|--------------------------------------------------------------------------
*/

const signalLog = [];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function calculateWeight(action) {
  return SIGNAL_WEIGHTS[action] || 0;
}

/*
|--------------------------------------------------------------------------
| GET /api/signal-weight
|--------------------------------------------------------------------------
| Engine status
*/

router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "H12 Signal Weight Engine live.",
    totalSignals: signalLog.length,
    weights: SIGNAL_WEIGHTS,
    routes: [
      "/api/signal-weight",
      "/api/signal-weight/signal",
      "/api/signal-weight/log"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| POST /api/signal-weight/signal
|--------------------------------------------------------------------------
| Convert action -> score
*/

router.post("/signal", (req, res) => {

  const { artistId, action } = req.body;

  if (!artistId || !action) {
    return res.status(400).json({
      success: false,
      message: "artistId and action are required"
    });
  }

  const value = calculateWeight(action);

  const signal = {
    id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    artistId,
    action,
    value,
    createdAt: new Date().toISOString()
  };

  signalLog.push(signal);

  return res.json({
    success: true,
    message: "Signal processed",
    signal
  });

});

/*
|--------------------------------------------------------------------------
| GET /api/signal-weight/log
|--------------------------------------------------------------------------
*/

router.get("/log", (req, res) => {

  return res.json({
    success: true,
    count: signalLog.length,
    signals: signalLog
  });

});

export default router;