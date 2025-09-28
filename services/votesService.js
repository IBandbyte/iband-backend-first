// services/votesService.js
// Lightweight vote store & helpers (dependency-light, testable, swap-to-DB later)

/**
 * TARGET TYPES we expect now (extend as needed):
 *  - 'artist'  (vote on an artist profile)
 *  - 'content' (vote on a track, live, clip, etc.)
 *
 * CHOICES are free-form strings like 'up', 'down', 'love', 'meh', etc.
 * We store one active vote per (userId, targetType, targetId).
 *
 * This module is intentionally in-memory so CI passes without a database.
 * Later we can replace the in-memory maps with Mongo models behind the same API.
 */

const { randomUUID } = require('crypto');

// --- Internal state (in-memory) ---
/** @type {Map<string, { id: string, userId: string, targetType: string, targetId: string, choice: string, ip?: string, userAgent?: string, createdAt: string, updatedAt: string }>} */
const votes = new Map(); // key = voteId

/** @type {Map<string, string>} */
const userTargetIndex = new Map(); // key = `${userId}|${targetType}|${targetId}` -> voteId

/** @type {Map<string, number>} */
const rateLimitKeyLastAt = new Map(); // key = `${userId}|${targetType}|${targetId}` -> timestamp

const ONE_MINUTE = 60 * 1000;

// --- Utils ---
const nowISO = () => new Date().toISOString();

function clampStr(x, n = 200) {
  if (!x) return x;
  x = String(x);
  return x.length > n ? x.slice(0, n) : x;
}

function rateLimitOk(userId, targetType, targetId) {
  const key = `${userId}|${targetType}|${targetId}`;
  const last = rateLimitKeyLastAt.get(key) || 0;
  const delta = Date.now() - last;
  if (delta < ONE_MINUTE) return false;
  rateLimitKeyLastAt.set(key, Date.now());
  return true;
}

// --- Public API ---

/**
 * Create or update the user's vote on a target.
 * Enforces 1 vote per (user, targetType, targetId). Re-voting updates the choice+timestamps.
 */
function castVote({ userId, targetType, targetId, choice, ip, userAgent, skipRateLimit = false }) {
  // Basic sanitize
  userId = clampStr(userId || 'anon', 120);
  targetType = clampStr(targetType || 'artist', 40).toLowerCase();
  targetId = clampStr(targetId || '', 120);
  choice = clampStr(choice || 'up', 40).toLowerCase();

  if (!userId || !targetType || !targetId || !choice) {
    throw new Error('Missing required fields (userId, targetType, targetId, choice).');
  }

  if (!skipRateLimit && !rateLimitOk(userId, targetType, targetId)) {
    const err = new Error('Too many votes for this target. Please wait a minute before trying again.');
    err.status = 429;
    throw err;
  }

  const idxKey = `${userId}|${targetType}|${targetId}`;
  const existingId = userTargetIndex.get(idxKey);

  if (existingId) {
    // Update existing vote
    const v = votes.get(existingId);
    if (!v) {
      // Index was stale; treat as create
      userTargetIndex.delete(idxKey);
      return _createNewVote({ userId, targetType, targetId, choice, ip, userAgent });
    }
    v.choice = choice;
    v.ip = clampStr(ip, 60) || v.ip;
    v.userAgent = clampStr(userAgent, 200) || v.userAgent;
    v.updatedAt = nowISO();
    return { created: false, vote: { ...v } };
  }

  // Create new vote
  return _createNewVote({ userId, targetType, targetId, choice, ip, userAgent });
}

function _createNewVote({ userId, targetType, targetId, choice, ip, userAgent }) {
  const id = randomUUID();
  const rec = {
    id,
    userId,
    targetType,
    targetId,
    choice,
    ip: clampStr(ip, 60),
    userAgent: clampStr(userAgent, 200),
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  votes.set(id, rec);
  userTargetIndex.set(`${userId}|${targetType}|${targetId}`, id);
  return { created: true, vote: { ...rec } };
}

/**
 * Summarize votes for a target.
 * Returns { targetType, targetId, total, breakdown: { [choice]: count }, lastUpdated }
 */
function getSummary({ targetType, targetId }) {
  targetType = clampStr((targetType || '').toLowerCase(), 40);
  targetId = clampStr(targetId || '', 120);
  if (!targetType || !targetId) {
    throw new Error('Missing targetType or targetId.');
  }

  const breakdown = Object.create(null);
  let total = 0;
  let lastUpdated = null;

  for (const v of votes.values()) {
    if (v.targetType === targetType && v.targetId === targetId) {
      total += 1;
      breakdown[v.choice] = (breakdown[v.choice] || 0) + 1;
      if (!lastUpdated || v.updatedAt > lastUpdated) lastUpdated = v.updatedAt;
    }
  }

  return {
    targetType,
    targetId,
    total,
    breakdown,
    lastUpdated,
  };
}

/**
 * Fetch the current user's vote on a target (if any).
 */
function getUserVote({ userId, targetType, targetId }) {
  userId = clampStr(userId || 'anon', 120);
  targetType = clampStr((targetType || '').toLowerCase(), 40);
  targetId = clampStr(targetId || '', 120);
  if (!userId || !targetType || !targetId) {
    throw new Error('Missing userId, targetType or targetId.');
  }

  const idxKey = `${userId}|${targetType}|${targetId}`;
  const vid = userTargetIndex.get(idxKey);
  return vid ? { ...votes.get(vid) } : null;
}

/**
 * Delete a vote by id (admin/moderator or the same user in future with auth).
 * Returns true if removed.
 */
function deleteVote(voteId) {
  const rec = votes.get(voteId);
  if (!rec) return false;
  votes.delete(voteId);
  userTargetIndex.delete(`${rec.userId}|${rec.targetType}|${rec.targetId}`);
  return true;
}

// --- Test hook / dev maintenance ---
function _resetForTests() {
  votes.clear();
  userTargetIndex.clear();
  rateLimitKeyLastAt.clear();
}

module.exports = {
  castVote,
  getSummary,
  getUserVote,
  deleteVote,
  _resetForTests,

  // exposed for diagnostics (avoid in production APIs)
  __debug: {
    _votes: votes,
    _userTargetIndex: userTargetIndex,
  },
};