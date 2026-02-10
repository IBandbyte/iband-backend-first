// votes.js
// iBand Backend — Votes Routes (ESM)
// Winning pattern/formula:
// - single source of truth via artistsStore
// - consistent JSON responses
// - future-proof endpoints (leaderboard, bulk vote)
// - route-order safe (static routes BEFORE param routes)
// - Render-safe ESM default export

import express from "express";
import artistsStore from "./artistsStore.js";

const router = express.Router();

/* -------------------- Helpers -------------------- */

const nowIso = () => new Date().toISOString();

const safeText = (v) => (v === null || v === undefined ? "" : String(v)).trim();

const toInt = (v, fallback = 0) => {
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
};

const clampInt = (n, min, max) => {
  const x = toInt(n, 0);
  if (x < min) return min;
  if (x > max) return max;
  return x;
};

function normalizeIdCandidates(raw) {
  const original = safeText(raw);
  const decoded = (() => {
    try {
      return decodeURIComponent(original);
    } catch {
      return original;
    }
  })();

  const lower = safeText(decoded).toLowerCase();
  const sluggy = lower
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  // unique, in priority order
  const set = new Set([original, decoded, lower, sluggy].filter(Boolean));
  return Array.from(set);
}

function getStoreFns() {
  // Supports BOTH modern + alias names.
  const getArtist =
    typeof artistsStore.getArtist === "function"
      ? (id) => artistsStore.getArtist(id)
      : typeof artistsStore.getById === "function"
      ? (id) => artistsStore.getById(id)
      : null;

  const patchArtist =
    typeof artistsStore.patchArtist === "function"
      ? (id, patch) => artistsStore.patchArtist(id, patch)
      : typeof artistsStore.patch === "function"
      ? (id, patch) => artistsStore.patch(id, patch)
      : null;

  const listArtists =
    typeof artistsStore.listArtists === "function"
      ? () => artistsStore.listArtists()
      : typeof artistsStore.getAll === "function"
      ? () => artistsStore.getAll()
      : () => [];

  return { getArtist, patchArtist, listArtists };
}

function findArtistByAnyId(rawId) {
  const { getArtist } = getStoreFns();
  if (!getArtist) return { artist: null, tried: [] };

  const tried = normalizeIdCandidates(rawId);
  for (const id of tried) {
    const a = getArtist(id);
    if (a) return { artist: a, tried };
  }
  return { artist: null, tried };
}

function patchVotes(id, nextVotes) {
  const { patchArtist } = getStoreFns();
  if (!patchArtist) return null;
  return patchArtist(id, { votes: nextVotes });
}

function persistenceHint() {
  return "If this worked before a redeploy and fails after, your Render filesystem/in-memory store likely reset. Use a seed endpoint or add persistent storage (Render Disk / database).";
}

/* -------------------- Guard (misconfig) -------------------- */

router.use((req, res, next) => {
  const { getArtist, patchArtist } = getStoreFns();
  if (!getArtist || !patchArtist) {
    return res.status(500).json({
      success: false,
      message:
        "Votes API misconfigured: artistsStore is missing getArtist/getById and/or patchArtist/patch.",
      ts: nowIso(),
      path: req.originalUrl,
    });
  }
  next();
});

/* -------------------- Routes (STATIC FIRST) -------------------- */

// GET /api/votes/health
router.get("/health", (_req, res) => {
  const { listArtists } = getStoreFns();
  const all = Array.isArray(listArtists?.()) ? listArtists() : [];
  return res.json({
    success: true,
    message: "votes ok",
    artistsKnown: all.length,
    ts: nowIso(),
  });
});

/**
 * GET /api/votes/leaderboard
 * Query:
 * - status=active (default)
 * - limit=20 (max 100)
 */
router.get("/leaderboard", (req, res) => {
  const { listArtists } = getStoreFns();
  const status = safeText(req.query?.status || "active").toLowerCase();
  const limit = Math.min(100, Math.max(1, toInt(req.query?.limit, 20)));

  const all = Array.isArray(listArtists?.()) ? listArtists() : [];
  const filtered = all.filter((a) => {
    const s = safeText(a?.status).toLowerCase();
    if (status === "all") return true;
    return s === status;
  });

  const sorted = filtered
    .slice()
    .sort((a, b) => toInt(b?.votes, 0) - toInt(a?.votes, 0))
    .slice(0, limit)
    .map((a) => ({
      id: safeText(a?.id),
      name: safeText(a?.name),
      votes: toInt(a?.votes, 0),
      status: safeText(a?.status),
      updatedAt: safeText(a?.updatedAt),
    }));

  return res.json({
    success: true,
    count: sorted.length,
    status,
    limit,
    leaderboard: sorted,
  });
});

/**
 * POST /api/votes/bulk
 * Batch votes update (future-proof for campaigns, imports, etc.)
 *
 * Body:
 * { "items": [ { "id": "bad-bunny", "delta": 1 }, ... ] }
 *
 * Safety:
 * - delta clamped [-100, 100] per item
 * - max 200 items
 */
router.post("/bulk", (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];

  if (!items.length) {
    return res.status(400).json({
      success: false,
      message: "Body must include items: [{ id, delta }].",
    });
  }

  const results = items.slice(0, 200).map((it) => {
    const id = safeText(it?.id);
    const delta = clampInt(it?.delta ?? 1, -100, 100);

    if (!id) return { ok: false, id: "", message: "Missing id." };

    const { artist } = findArtistByAnyId(id);
    if (!artist) return { ok: false, id, message: "Artist not found." };

    const current = toInt(artist.votes, 0);
    const updated = patchVotes(artist.id, current + delta);

    if (!updated) return { ok: false, id: artist.id, message: "Update failed." };

    return { ok: true, id: updated.id, delta, votes: toInt(updated.votes, 0) };
  });

  return res.json({
    success: true,
    count: results.length,
    results,
  });
});

/* -------------------- Routes (PARAM LAST) -------------------- */

/**
 * GET /api/votes/:id
 * Returns vote info for a given artist id.
 */
router.get("/:id", (req, res) => {
  const rawId = safeText(req.params?.id);
  if (!rawId) {
    return res.status(400).json({ success: false, message: "Artist id is required." });
  }

  const { artist, tried } = findArtistByAnyId(rawId);

  if (!artist) {
    return res.status(404).json({
      success: false,
      message: "Artist not found.",
      id: rawId,
      tried,
      hint: persistenceHint(),
    });
  }

  return res.json({
    success: true,
    id: artist.id,
    votes: toInt(artist.votes, 0),
    status: safeText(artist.status),
    artist: {
      id: artist.id,
      name: safeText(artist.name),
      votes: toInt(artist.votes, 0),
      status: safeText(artist.status),
      updatedAt: safeText(artist.updatedAt),
    },
  });
});

/**
 * POST /api/votes/:id
 * Increments votes for an artist.
 *
 * Body accepted:
 * - { "delta": 1 } or { "amount": 1 } or { "value": 1 }
 * If omitted, defaults to +1.
 *
 * Safety:
 * - clamps delta to [-100, 100]
 */
router.post("/:id", (req, res) => {
  const rawId = safeText(req.params?.id);
  if (!rawId) {
    return res.status(400).json({ success: false, message: "Artist id is required." });
  }

  const { artist, tried } = findArtistByAnyId(rawId);

  if (!artist) {
    return res.status(404).json({
      success: false,
      message: "Artist not found.",
      id: rawId,
      tried,
      hint: persistenceHint(),
    });
  }

  const rawDelta =
    req.body?.delta !== undefined
      ? req.body.delta
      : req.body?.amount !== undefined
      ? req.body.amount
      : req.body?.value !== undefined
      ? req.body.value
      : 1;

  const delta = clampInt(rawDelta, -100, 100);
  const current = toInt(artist.votes, 0);
  const nextVotes = current + delta;

  const updated = patchVotes(artist.id, nextVotes);

  if (!updated) {
    return res.status(500).json({
      success: false,
      message: "Failed to apply vote update.",
      id: artist.id,
    });
  }

  return res.json({
    success: true,
    message: "Vote recorded.",
    id: updated.id,
    delta,
    votes: toInt(updated.votes, 0),
    artist: {
      id: updated.id,
      name: safeText(updated.name),
      votes: toInt(updated.votes, 0),
      status: safeText(updated.status),
      updatedAt: safeText(updated.updatedAt),
    },
  });
});

/**
 * POST /api/votes/:id/quick
 * Convenience voting endpoint for UI buttons.
 *
 * Body accepted:
 * - { "type": "plus1" | "plus5" | "minus1" | "minus5" }
 * Defaults to "plus1"
 */
router.post("/:id/quick", (req, res) => {
  const rawId = safeText(req.params?.id);
  if (!rawId) {
    return res.status(400).json({ success: false, message: "Artist id is required." });
  }

  const { artist, tried } = findArtistByAnyId(rawId);

  if (!artist) {
    return res.status(404).json({
      success: false,
      message: "Artist not found.",
      id: rawId,
      tried,
      hint: persistenceHint(),
    });
  }

  const type = safeText(req.body?.type || "plus1").toLowerCase();
  const map = { plus1: 1, plus5: 5, minus1: -1, minus5: -5 };
  const delta = map[type] ?? 1;

  const current = toInt(artist.votes, 0);
  const updated = patchVotes(artist.id, current + delta);

  if (!updated) {
    return res.status(500).json({
      success: false,
      message: "Failed to apply vote update.",
      id: artist.id,
    });
  }

  return res.json({
    success: true,
    message: "Vote recorded.",
    id: updated.id,
    type,
    delta,
    votes: toInt(updated.votes, 0),
  });
});

export default router;