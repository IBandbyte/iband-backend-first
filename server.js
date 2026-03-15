// =====================================================
// iBand Backend Server
// Captain's Protocol Canonical Server
// =====================================================

const express = require("express")
const cors = require("cors")

const app = express()

// =====================================================
// Middleware
// =====================================================

app.use(cors())
app.use(express.json())

// =====================================================
// Safe Route Mount Helper
// Prevents crashes if a module is missing
// =====================================================

function mount(path, file) {
  try {
    const router = require(file)
    app.use(path, router)
    console.log(`[mount:ok] ${path} -> ${file}`)
  } catch (err) {
    console.log(`[mount:skip] ${path} -> ${file} (missing_file)`)
  }
}

// =====================================================
// Core Artist System
// =====================================================

mount("/api/artists", "./artists.js")
mount("/api/votes", "./votes.js")
mount("/api/ranking", "./ranking.js")

// =====================================================
// Gamification Systems
// =====================================================

mount("/api/medals", "./medals.js")
mount("/api/flash-medals", "./flashMedals.js")
mount("/api/achievements", "./achievements.js")

// =====================================================
// Monetisation Systems
// =====================================================

mount("/api/purchases", "./purchases.js")
mount("/api/monetisation", "./monetisationSignals.js")

// =====================================================
// Social Interaction
// =====================================================

mount("/api/shares", "./shares.js")
mount("/api/trends", "./trends.js")
mount("/api/ambassadors", "./ambassadors.js")
mount("/api/moderation", "./moderation.js")
mount("/api/rooms", "./rooms.js")
mount("/api/fans", "./fanProfiles.js")

// =====================================================
// Discovery Systems
// =====================================================

mount("/api/genres", "./genres.js")
mount("/api/countries", "./countries.js")
mount("/api/discovery", "./discovery.js")

// =====================================================
// Global Music Map
// =====================================================

mount("/api/world-map", "./world-map.js")
mount("/api/breakouts", "./breakouts.js")
mount("/api/cross-border", "./cross-border.js")
mount("/api/cross-border-momentum", "./cross-border-momentum.js")

// =====================================================
// Fan Impact Systems
// =====================================================

mount("/api/fan-impact", "./fan-impact.js")
mount("/api/fan-power", "./fan-power.js")
mount("/api/trend-starter", "./trend-starter.js")

// =====================================================
// Charts
// =====================================================

mount("/api/momentum-charts", "./momentum-charts.js")

// =====================================================
// Detection Engines
// =====================================================

mount("/api/surge", "./surge-detector.js")
mount("/api/discovery-boost", "./discovery-boost.js")
mount("/api/rising-now", "./rising-now.js")

// =====================================================
// Country Engines
// =====================================================

mount("/api/country-engine", "./countryEngine.js")

// =====================================================
// Map Intelligence Engines
// =====================================================

mount("/api/map-activity", "./mapActivity.js")
mount("/api/breakout", "./breakouts.js")
mount("/api/signal-weight", "./signalWeight.js")
mount("/api/explosion", "./explosion.js")
mount("/api/map-intelligence", "./mapIntelligence.js")

// =====================================================
// Radar System
// =====================================================

mount("/api/radar", "./radar.js")

// =====================================================
// Global Map Feed
// =====================================================

mount("/api/map-feed", "./mapFeed.js")

// =====================================================
// Breakout Alert System
// =====================================================

mount("/api/alerts", "./alerts.js")

// =====================================================
// Live Event Heat System
// =====================================================

mount("/api/live-heat", "./liveHeat.js")

// =====================================================
// Spin The Globe Discovery
// =====================================================

mount("/api/spin", "./spin.js")

// =====================================================
// Warp Drive Discovery Engine 🚀
// =====================================================

mount("/api/warp-drive", "./warpDrive.js")

// =====================================================
// Root Health Check
// =====================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "iBand Backend",
    status: "running",
    version: "Captain Protocol Server"
  })
})

// =====================================================
// Server Start
// =====================================================

const PORT = process.env.PORT || 10000

app.listen(PORT, () => {
  console.log(`[boot] iband-backend-first listening on port ${PORT}`)
})