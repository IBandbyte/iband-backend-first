/**
 * recs.js (root) — ESM default export
 * iBand Feed Generator (v4 — enriched + hard diagnostics)
 *
 * Adds:
 * - Reports the FULL artists path being read
 * - Reports readOk + parseOk + file size
 * - Attempts fallback read paths if env path is wrong
 *
 * Goal:
 * - Eliminate guessing about which artists.json is being used on Render.
 */

import express from "express";
import fs from "fs/promises";
import path from "path";

const router = express.Router();

/* -----------------------------
 * Config
 * ----------------------------- */
const DATA_DIR = process.env.DATA_DIR || "/var/data/iband/db";
const EVENTS_AGG_FILE =
  process.env.EVENTS_AGG_FILE || path.join(DATA_DIR, "events-agg.json");

// Primary (env-driven) artists file path:
const ARTISTS_FILE_ENV =
  process.env.ARTISTS_FILE || path.join(DATA_DIR, "artists.json");

// Canonical disk path we expect on Render:
const ARTISTS_FILE_CANON = path.join(DATA_DIR, "artists.json");

// Dev fallback (repo root) if needed:
const ARTISTS_FILE_LOCAL = path.resolve("./artists.json");

const MAX_RETURN = parseInt(process.env.RECS_MAX_RETURN || "50", 10);
const routerVersion = 4;

/* -----------------------------
 * Helpers
 * ----------------------------- */
function nowIso() {
  return new Date().toISOString();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function safeNumber(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

async function statSafe(p) {
  try {
    const st = await fs.stat(p);
    return { ok: true, size: st.size, mtimeMs: st.mtimeMs };
  } catch (e) {
    return { ok: false, error: e?.code || e?.message || "stat_failed" };
  }
}

async function readFileSafe(p) {
  try {
    const raw = await fs.readFile(p, "utf8");
    return { ok: true, raw };
  } catch (e) {
    return { ok: false, error: e?.code || e?.message || "read_failed" };
  }
}

function parseJsonSafe(raw) {
  try {
    const obj = JSON.parse(raw);
    return { ok: true, obj };
  } catch (e) {
    return { ok: false, error: e?.message || "parse_failed" };
  }
}

async function loadAgg() {
  const base = { updatedAt: null, byArtist: {} };
  const r = await readFileSafe(EVENTS_AGG_FILE);
  if (!r.ok) return base;

  const p = parseJsonSafe(r.raw);
  if (!p.ok || !p.obj || typeof p.obj !== "object") return base;

  if (!p.obj.byArtist || typeof p.obj.byArtist !== "object") p.obj.byArtist = {};
  return p.obj;
}

function extractArtistsArray(store) {
  if (!store || typeof store !== "object") return [];
  if (Array.isArray(store.artists)) return store.artists;
  if (store.data && Array.isArray(store.data.artists)) return store.data.artists;
  return [];
}

async function loadArtistsMapWithDiagnostics() {
  const candidates = [
    { label: "env", path: ARTISTS_FILE_ENV },
    { label: "canon", path: ARTISTS_FILE_CANON },
    { label: "local", path: ARTISTS_FILE_LOCAL },
  ];

  const diag = {
    selected: null,
    attempts: [],
    artistsLoaded: 0,
  };

  for (const c of candidates) {
    const attempt = {
      label: c.label,
      path: c.path,
      stat: await statSafe(c.path),
      readOk: false,
      parseOk: false,
      topKeys: null,
      artistsArrayLen: 0,
      error: null,
    };

    if (!attempt.stat.ok) {
      attempt.error = `stat:${attempt.stat.error}`;
      diag.attempts.push(attempt);
      continue;
    }

    const r = await readFileSafe(c.path);
    if (!r.ok) {
      attempt.error = `read:${r.error}`;
      diag.attempts.push(attempt);
      continue;
    }

    attempt.readOk = true;

    const p = parseJsonSafe(r.raw);
    if (!p.ok) {
      attempt.error = `parse:${p.error}`;
      diag.attempts.push(attempt);
      continue;
    }

    attempt.parseOk = true;

    const obj = p.obj;
    attempt.topKeys = obj && typeof obj === "object" ? Object.keys(obj).slice(0, 12) : null;

    const arr = extractArtistsArray(obj);
    attempt.artistsArrayLen = Array.isArray(arr) ? arr.length : 0;

    if (attempt.artistsArrayLen > 0) {
      // Build map
      const map = {};
      for (const a of arr) {
        if (a && typeof a === "object" && typeof a.id === "string" && a.id.trim()) {
          map[a.id.trim()] = a;
        }
      }
      diag.selected = { label: c.label, path: c.path };
      diag.artistsLoaded = Object.keys(map).length;
      return { map, diag };
    }

    diag.attempts.push(attempt);
  }

  // No artists found in any candidate
  return { map: {}, diag };
}

/* -----------------------------
 * Rising score (same as ranking v2)
 * ----------------------------- */
function risingScoreFromBucket(bucket) {
  const W_VIEW = 1.0;
  const W_REPLAY = 2.5;
  const W_LIKE = 1.5;
  const W_SAVE = 3.5;
  const W_SHARE = 4.5;
  const W_FOLLOW = 5.0;
  const W_COMMENT = 2.0;
  const W_VOTE = 1.0;

  const WATCHMS_PER_POINT = 10000;
  const HALF_LIFE_HOURS = 24;

  const views = safeNumber(bucket.views);
  const replays = safeNumber(bucket.replays);
  const likes = safeNumber(bucket.likes);
  const saves = safeNumber(bucket.saves);
  const shares = safeNumber(bucket.shares);
  const follows = safeNumber(bucket.follows);
  const comments = safeNumber(bucket.comments);
  const votes = safeNumber(bucket.votes);
  const watchMs = safeNumber(bucket.watchMs);

  const watchPoints = watchMs / Math.max(1000, WATCHMS_PER_POINT);

  const weighted =
    views * W_VIEW +
    replays * W_REPLAY +
    likes * W_LIKE +
    saves * W_SAVE +
    shares * W_SHARE +
    follows * W_FOLLOW +
    comments * W_COMMENT +
    votes * W_VOTE +
    watchPoints;

  let freshness = 1.0;
  if (bucket.lastAt) {
    const ageMs = Date.now() - Date.parse(bucket.lastAt);
    if (Number.isFinite(ageMs)) {
      const ageH = ageMs / (1000 * 60 * 60);
      freshness = Math.pow(0.5, ageH / HALF_LIFE_HOURS);
      freshness = clamp(freshness, 0.05, 1.0);
    }
  }

  return Number((weighted * freshness).toFixed(6));
}

/* -----------------------------
 * Middleware
 * ----------------------------- */
router.use(express.json({ limit: "64kb" }));

/* -----------------------------
 * Endpoints
 * ----------------------------- */
router.get("/health", async (_req, res) => {
  const { diag } = await loadArtistsMapWithDiagnostics();

  res.json({
    success: true,
    service: "recs",
    version: routerVersion,
    enriched: true,
    updatedAt: nowIso(),
    sources: {
      dataDir: DATA_DIR,
      eventsAgg: EVENTS_AGG_FILE,
      artistsEnv: ARTISTS_FILE_ENV,
      artistsCanon: ARTISTS_FILE_CANON,
      artistsLocal: ARTISTS_FILE_LOCAL,
    },
    artists: diag,
    maxReturn: MAX_RETURN,
  });
});

router.get("/rising", async (req, res) => {
  const limit = clamp(
    parseInt(req.query.limit || `${MAX_RETURN}`, 10) || MAX_RETURN,
    1,
    MAX_RETURN
  );

  const agg = await loadAgg();
  const { map: artistMap, diag } = await loadArtistsMapWithDiagnostics();

  const rows = [];
  for (const [artistIdRaw, bucket] of Object.entries(agg.byArtist || {})) {
    const artistId = String(artistIdRaw || "").trim();
    const score = risingScoreFromBucket(bucket);
    const artist = artistMap[artistId] || null;

    rows.push({
      artist: artist
        ? {
            id: artist.id,
            name: artist.name || null,
            imageUrl: artist.imageUrl || null,
            genre: artist.genre || null,
            location: artist.location || null,
          }
        : { id: artistId },
      score,
      lastAt: bucket.lastAt || null,
      metrics: {
        views: safeNumber(bucket.views),
        replays: safeNumber(bucket.replays),
        watchMs: safeNumber(bucket.watchMs),
      },
    });
  }

  rows.sort((a, b) => b.score - a.score);

  res.json({
    success: true,
    updatedAt: agg.updatedAt || null,
    artistsLoaded: diag.artistsLoaded,
    artistsSelected: diag.selected,
    count: rows.length,
    results: rows.slice(0, limit),
  });
});

export default router;