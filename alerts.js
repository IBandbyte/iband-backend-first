import express from "express";
import { getTopBreakouts, getArtistBreakout } from "./breakoutEngine.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| H17 Breakout Alert System
|--------------------------------------------------------------------------
| Purpose:
| - create alert-ready backend events
| - convert breakout momentum into notification-style objects
| - support future flash alerts, live bars and discovery notifications
|--------------------------------------------------------------------------
*/

const ALERT_RULES = [
  {
    level: "quiet",
    minScore: 0,
    severity: "low",
    icon: "❄️",
    label: "Quiet Discovery",
    alertEnabled: false
  },
  {
    level: "hidden_gem",
    minScore: 10,
    severity: "low",
    icon: "💎",
    label: "Hidden Gem",
    alertEnabled: false
  },
  {
    level: "rising",
    minScore: 50,
    severity: "medium",
    icon: "🌱",
    label: "Rising Fast",
    alertEnabled: true
  },
  {
    level: "trending",
    minScore: 150,
    severity: "high",
    icon: "🔥",
    label: "Trending Now",
    alertEnabled: true
  },
  {
    level: "viral",
    minScore: 400,
    severity: "critical",
    icon: "🚀",
    label: "Going Viral",
    alertEnabled: true
  },
  {
    level: "breakout_explosion",
    minScore: 800,
    severity: "critical",
    icon: "💥",
    label: "Breakout Explosion",
    alertEnabled: true
  }
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getAlertRule(score) {
  let selected = ALERT_RULES[0];

  for (const rule of ALERT_RULES) {
    if (score >= rule.minScore) {
      selected = rule;
    }
  }

  return selected;
}

function buildAlert(artistId) {
  const breakout = getArtistBreakout(artistId);
  const rule = getAlertRule(breakout.score);

  return {
    artistId: breakout.artistId,
    score: breakout.score,
    breakoutStage: breakout.stage,
    alert: {
      enabled: rule.alertEnabled,
      severity: rule.severity,
      icon: rule.icon,
      label: rule.label,
      title:
        rule.level === "breakout_explosion"
          ? "💥 Breakout Explosion detected"
          : rule.level === "viral"
            ? "🚀 Artist going viral"
            : rule.level === "trending"
              ? "🔥 Artist trending now"
              : rule.level === "rising"
                ? "🌱 Artist rising fast"
                : "No alert",
      message:
        rule.level === "breakout_explosion"
          ? "A major breakout event has been detected."
          : rule.level === "viral"
            ? "Momentum is accelerating rapidly."
            : rule.level === "trending"
              ? "This artist is building strong momentum."
              : rule.level === "rising"
                ? "Early discovery momentum detected."
                : "Alert threshold not reached."
    }
  };
}

/*
|--------------------------------------------------------------------------
| GET
| Root summary
|--------------------------------------------------------------------------
*/
router.get("/", (req, res) => {
  const top = getTopBreakouts(50);
  const activeAlerts = top.filter((artist) => artist.score >= 50).length;

  return res.json({
    success: true,
    message: "H17 Breakout Alert System live.",
    trackedArtists: top.length,
    activeAlerts,
    rules: ALERT_RULES,
    routes: [
      "/api/alerts",
      "/api/alerts/top",
      "/api/alerts/:artistId"
    ]
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Top alert candidates
|--------------------------------------------------------------------------
*/
router.get("/top", (req, res) => {
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 10;

  const artists = getTopBreakouts(limit).map((artist) =>
    buildAlert(artist.artistId)
  );

  return res.json({
    success: true,
    count: artists.length,
    artists
  });
});

/*
|--------------------------------------------------------------------------
| GET
| Single artist alert
|--------------------------------------------------------------------------
*/
router.get("/:artistId", (req, res) => {
  const artistId = String(req.params.artistId || "").trim();

  if (!artistId) {
    return res.status(400).json({
      success: false,
      message: "artistId is required"
    });
  }

  const alert = buildAlert(artistId);

  return res.json({
    success: true,
    ...alert
  });
});

export default router;