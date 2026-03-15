// ===============================
// iBand Backend Server
// Captain's Protocol Version
// ===============================

const express = require("express")
const cors = require("cors")

const app = express()

app.use(cors())
app.use(express.json())

// ===============================
// ROUTE MOUNTS
// ===============================

function mount(path, file) {
  try {
    const router = require(file)
    app.use(path, router)
    console.log(`[mount:ok] ${path} -> ${file}`)
  } catch (err) {
    console.log(`[mount:skip] ${path} -> ${file} (missing_file)`)
  }
}

// Core
mount("/api/artists", "./artists.js")
mount("/api/votes", "./votes.js")
mount("/api/ranking", "./ranking.js")

// Gamification
mount("/api/medals", "./medals.js")
mount("/api/flash-medals", "./flashMedals.js")
mount("/api/achievements", "./achievements.js")

// Monetisation
mount("/api/purchases", "./purchases.js")
mount("/api/monetisation", "./monetisationSignals.js")

// Social
mount("/api/shares", "./shares.js")
mount("/api/trends", "./trends.js")
mount("/api/ambassadors", "./ambassadors.js")
mount("/api/moderation", "./moderation.js")
mount("/api/rooms", "./rooms.js")
mount("/api/fans", "./fanProfiles.js")

// Discovery
mount("/api/genres", "./genres.js")
mount("/api/countries", "./countries.js")
mount("/api/discovery", "./discovery.js")

// Global Map Systems
mount("/api/world-map", "./world-map.js")
mount("/api/breakouts", "./breakouts.js")
mount("/api/cross-border", "./cross-border.js")
mount("/api/cross-border-momentum", "./cross-border-momentum.js")

// Fan impact
mount("/api/fan-impact", "./fan-impact.js")
mount("/api/fan-power", "./fan-power.js")
mount("/api/trend-starter", "./trend-starter.js")

// Charts
mount("/api/momentum-charts", "./momentum-charts.js")

// Detection engines
mount("/api/surge", "./surge-detector.js")
mount("/api/discovery-boost", "./discovery-boost.js")
mount("/api/rising-now", "./rising-now.js")

// Country engines
mount("/api/country-engine", "./countryEngine.js")

// Map intelligence
mount("/api/map-activity", "./mapActivity.js")
mount("/api/breakout", "./breakouts.js")
mount("/api/signal-weight", "./signalWeight.js")
mount("/api/explosion", "./explosion.js")
mount("/api/map-intelligence", "./mapIntelligence.js")

// Radar
mount("/api/radar", "./radar.js")

// Map Feed
mount("/api/map-feed", "./mapFeed.js")

// Alerts
mount("/api/alerts", "./alerts.js")

// Live heat
mount("/api/live-heat", "./liveHeat.js")

// Spin The Globe
mount("/api/spin", "./spin.js")

// 🚀 Warp Drive Discovery
mount("/api/warp-drive", "./warpDrive.js")

// ===============================
// ROOT
// ===============================

app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "iBand Backend",
    status: "running"
  })
})

// ===============================
// SERVER START
// ===============================

const PORT = process.env.PORT || 10000

app.listen(PORT, () => {
  console.log(`[boot] iband-backend-first listening on port ${PORT}`)
})