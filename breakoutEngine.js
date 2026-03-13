/**
 * ==========================================================
 * iBand Breakout Engine
 * Detects viral momentum and breakout explosions
 * ==========================================================
 */

const breakoutStore = {}

/**
 * Momentum thresholds
 */
const BREAKOUT_LEVELS = [
  {
    level: "quiet",
    minScore: 0,
    color: "blue",
    icon: "❄️"
  },
  {
    level: "rising",
    minScore: 50,
    color: "yellow",
    icon: "⚡"
  },
  {
    level: "trending",
    minScore: 150,
    color: "magenta",
    icon: "🔥"
  },
  {
    level: "viral",
    minScore: 400,
    color: "red",
    icon: "🚀"
  },
  {
    level: "explosion",
    minScore: 800,
    color: "gold",
    icon: "💥"
  }
]

/**
 * Record engagement signal
 */
function recordSignal(artistId, type, value = 1) {

  if (!artistId) return null

  if (!breakoutStore[artistId]) {
    breakoutStore[artistId] = {
      artistId,
      score: 0,
      signals: [],
      createdAt: new Date()
    }
  }

  const signal = {
    id: `sig_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    type,
    value,
    createdAt: new Date()
  }

  breakoutStore[artistId].signals.push(signal)

  breakoutStore[artistId].score += value

  return signal
}

/**
 * Determine breakout level
 */
function getBreakoutLevel(score) {

  let stage = BREAKOUT_LEVELS[0]

  for (const level of BREAKOUT_LEVELS) {
    if (score >= level.minScore) {
      stage = level
    }
  }

  return stage
}

/**
 * Get artist momentum
 */
function getArtistMomentum(artistId) {

  const artist = breakoutStore[artistId]

  if (!artist) {
    return {
      artistId,
      score: 0,
      stage: BREAKOUT_LEVELS[0]
    }
  }

  const stage = getBreakoutLevel(artist.score)

  return {
    artistId,
    score: artist.score,
    stage
  }
}

/**
 * Get all breakout artists
 */
function getAllMomentum() {

  const results = []

  for (const artistId in breakoutStore) {

    const artist = breakoutStore[artistId]

    const stage = getBreakoutLevel(artist.score)

    results.push({
      artistId,
      score: artist.score,
      stage
    })
  }

  return results
}

/**
 * Get top trending artists
 */
function getTopArtists(limit = 10) {

  const all = getAllMomentum()

  return all
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

module.exports = {
  recordSignal,
  getArtistMomentum,
  getAllMomentum,
  getTopArtists
}