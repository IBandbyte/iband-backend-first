import express from "express"

const router = express.Router()

/*
H38 — Fan Energy Engine
Calculates fan influence energy by region.

Signals considered:
- votes
- shares
- comments
- discoveries
- trendStarter
*/

const fanEnergySignals = [
  {
    id: "energy_001",
    country: "Brazil",
    votes: 520,
    shares: 140,
    comments: 210,
    discoveries: 88,
    trendStarters: 9,
    energyScore: 92,
    level: "Extreme",
    icon: "⚡",
    message: "Fan energy surge detected in Brazil."
  },
  {
    id: "energy_002",
    country: "Nigeria",
    votes: 470,
    shares: 110,
    comments: 190,
    discoveries: 76,
    trendStarters: 11,
    energyScore: 88,
    level: "Very High",
    icon: "🔥",
    message: "Strong fan-powered discovery activity."
  },
  {
    id: "energy_003",
    country: "Spain",
    votes: 280,
    shares: 90,
    comments: 140,
    discoveries: 55,
    trendStarters: 6,
    energyScore: 67,
    level: "High",
    icon: "✨",
    message: "Growing fan engagement momentum."
  },
  {
    id: "energy_004",
    country: "Japan",
    votes: 210,
    shares: 60,
    comments: 98,
    discoveries: 40,
    trendStarters: 4,
    energyScore: 54,
    level: "Rising",
    icon: "⚡",
    message: "Fan energy building across regional discovery."
  }
]

/*
Root
*/

router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "H38 Fan Energy Engine live.",
    count: fanEnergySignals.length,
    routes: [
      "/api/fan-energy",
      "/api/fan-energy/list",
      "/api/fan-energy/strong",
      "/api/fan-energy/random"
    ]
  })
})

/*
List
*/

router.get("/list", (req, res) => {
  res.json({
    success: true,
    count: fanEnergySignals.length,
    fanEnergy: fanEnergySignals
  })
})

/*
Strong energy
*/

router.get("/strong", (req, res) => {
  const strong = fanEnergySignals.filter(e => e.energyScore >= 80)

  res.json({
    success: true,
    count: strong.length,
    fanEnergy: strong
  })
})

/*
Random
*/

router.get("/random", (req, res) => {
  const random =
    fanEnergySignals[Math.floor(Math.random() * fanEnergySignals.length)]

  res.json({
    success: true,
    fanEnergy: random
  })
})

export default router