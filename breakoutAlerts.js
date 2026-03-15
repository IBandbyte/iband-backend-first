import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H31 Breakout Alert Engine
|--------------------------------------------------------------------------
| Creates alert objects when artists hit important breakout thresholds.
|--------------------------------------------------------------------------
*/

const BREAKOUT_ALERTS = [
  {
    id: "alert_001",
    artist: "Demo Artist Brazil",
    country: "Brazil",
    breakoutScore: 78,
    status: "Strong Breakout Potential",
    confidence: "High",
    severity: "medium",
    icon: "🚀",
    message: "Momentum is building fast in Brazil."
  },
  {
    id: "alert_002",
    artist: "Demo Artist Nigeria",
    country: "Nigeria",
    breakoutScore: 92,
    status: "Breakout Imminent",
    confidence: "High",
    severity: "critical",
    icon: "💥",
    message: "Breakout threshold crossed. Viral event likely."
  },
  {
    id: "alert_003",
    artist: "Demo Artist Argentina",
    country: "Argentina",
    breakoutScore: 61,
    status: "Emerging",
    confidence: "Medium",
    severity: "low",
    icon: "⚡",
    message: "Artist is gaining early traction."
  },
  {
    id: "alert_004",
    artist: "Demo Artist Japan",
    country: "Japan",
    breakoutScore: 67,
    status: "Emerging",
    confidence: "Medium",
    severity: "low",
    icon: "⚡",
    message: "Growth signals increasing across discovery engines."
  },
  {
    id: "alert_005",
    artist: "Demo Artist Greece",
    country: "Greece",
    breakoutScore: 48,
    status: "Developing",
    confidence: "Low",
    severity: "info",
    icon: "🌱",
    message: "Artist is still in early development stage."
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getCriticalAlerts() {
  return BREAKOUT_ALERTS.filter((alert) => alert.severity === "critical");
}

function getRandomAlert() {
  const index = Math.floor(Math.random() * BREAKOUT_ALERTS.length);
  return {
    ...BREAKOUT_ALERTS[index],
    generatedAt: new Date().toISOString()
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/breakout-alerts
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "H31 Breakout Alert Engine live.",
    count: BREAKOUT_ALERTS.length,
    routes: [
      "/api/breakout-alerts",
      "/api/breakout-alerts/list",
      "/api/breakout-alerts/critical",
      "/api/breakout-alerts/random"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/breakout-alerts/list
|--------------------------------------------------------------------------
*/

router.get("/list", (req, res) => {
  return res.json({
    success: true,
    count: BREAKOUT_ALERTS.length,
    alerts: BREAKOUT_ALERTS
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/breakout-alerts/critical
|--------------------------------------------------------------------------
*/

router.get("/critical", (req, res) => {
  const critical = getCriticalAlerts();

  return res.json({
    success: true,
    count: critical.length,
    alerts: critical
  });
});

/*
|--------------------------------------------------------------------------
| GET /api/breakout-alerts/random
|--------------------------------------------------------------------------
*/

router.get("/random", (req, res) => {
  const alert = getRandomAlert();

  return res.json({
    success: true,
    alert
  });
});

export default router;