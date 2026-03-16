import express from "express"

const router = express.Router()

/*
H39 — Global Momentum Brain

Combines multiple discovery engines to calculate
the Global Momentum Score.

Signals combined:

fanEnergy
momentumPulse
heatMap
breakoutProbability
crossBorder
viralStream
hiddenGems
activityFeed
*/

const momentumSignals = [
  {
    id: "momentum_001",
    artist: "Demo Artist Nigeria",
    country: "Nigeria",
    fanEnergy: 88,
    momentumPulse: 92,
    heatMap: 91,
    breakoutProbability: 94,
    crossBorder: 85,
    viralStream: 90,
    hiddenGems: 70,
    activityFeed: 82,
    globalMomentumScore: 90,
    status: "Breakout Imminent",
    icon: "🚀",
    message: "Multiple discovery engines confirm a global breakout forming."
  },
  {
    id: "momentum_002",
    artist: "Demo Artist Brazil",
    country: "Brazil",
    fanEnergy: 92,
    momentumPulse: 88,
    heatMap: 87,
    breakoutProbability: 89,
    crossBorder: 83,
    viralStream: 86,
    hiddenGems: 60,
    activityFeed: 80,
    globalMomentumScore: 88,
    status: "High Momentum",
    icon: "🔥",
    message: "Strong fan-driven discovery momentum detected."
  },
  {
    id: "momentum_003",
    artist: "Demo Artist Japan",
    country: "Japan",
    fanEnergy: 54,
    momentumPulse: 68,
    heatMap: 64,
    breakoutProbability: 71,
    crossBorder: 62,
    viralStream: 60,
    hiddenGems: 75,
    activityFeed: 59,
    globalMomentumScore: 64,
    status: "Rising Discovery",
    icon: "📡",
    message: "Regional discovery momentum building."
  },
  {
    id: "momentum_004",
    artist: "Demo Artist Greece",
    country: "Greece",
    fanEnergy: 61,
    momentumPulse: 65,
    heatMap: 66,
    breakoutProbability: 63,
    crossBorder: 55,
    viralStream: 58,
    hiddenGems: 82,
    activityFeed: 60,
    globalMomentumScore: 64,
    status: "Hidden Gem Growth",
    icon: "💎",
    message: "Hidden gem discovery signals increasing."
  }
]

/*
Root
*/

router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "H39 Global Momentum Brain live.",
    count: momentumSignals.length,
    routes: [
      "/api/global-momentum",
      "/api/global-momentum/list",
      "/api/global-momentum/top",
      "/api/global-momentum/random"
    ]
  })
})

/*
List
*/

router.get("/list", (req, res) => {
  res.json({
    success: true,
    count: momentumSignals.length,
    momentum: momentumSignals
  })
})

/*
Top momentum
*/

router.get("/top", (req, res) => {
  const top = momentumSignals.filter(m => m.globalMomentumScore >= 85)

  res.json({
    success: true,
    count: top.length,
    momentum: top
  })
})

/*
Random
*/

router.get("/random", (req, res) => {
  const random =
    momentumSignals[Math.floor(Math.random() * momentumSignals.length)]

  res.json({
    success: true,
    momentum: random
  })
})

export default router