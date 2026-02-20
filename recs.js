// recs.js
// iBand Backend — Recs Mix (v6.2 Medal Integrated)
// Root-level router: mounted at /api/recs
//
// Step 6.2:
// - Inject medal tier into ALL feed results
// - Loads medal table once per request
// - Safe fallback if medal engine fails
//
// Captain’s Protocol: full canonical, future-proof, Render-safe, always JSON.

import fs from "fs";
import path from "path";
import crypto from "crypto";
import express from "express";
import { buildMedalTable } from "./medals.js"; // Medal engine

const router = express.Router();

// -------------------------
// Config
// -------------------------
const SERVICE = "recs-mix";
const VERSION = 26;

const DATA_DIR = process.env.IBAND_DATA_DIR || "/var/data/iband/db";
const EVENTS_AGG = process.env.IBAND_EVENTS_AGG || path.join(DATA_DIR, "events-agg.json");
const ARTISTS_FILE_CANON = path.join(DATA_DIR, "artists.json");
const EVENT_LOG = process.env.IBAND_EVENTS_LOG || path.join(DATA_DIR, "events.jsonl");
const STATE_FILE = process.env.IBAND_RECS_STATE || path.join(DATA_DIR, "recs-state.json");

// -------------------------
// Safe Medal Loader
// -------------------------
async function loadMedalTableSafe() {
  try {
    const table = await buildMedalTable();
    return table || {};
  } catch {
    return {};
  }
}

// -------------------------
// Utility Helpers
// -------------------------
function nowIso() {
  return new Date().toISOString();
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function readJsonIfExists(p) {
  try {
    if (!fs.existsSync(p)) return { ok: false, value: null, error: "ENOENT" };
    const raw = fs.readFileSync(p, "utf8");
    const val = safeJsonParse(raw, null);
    if (!val) return { ok: false, value: null, error: "EJSONPARSE" };
    return { ok: true, value: val, error: null };
  } catch (e) {
    return { ok: false, value: null, error: e?.message || "EREAD" };
  }
}

function writeJsonAtomic(p, obj) {
  const tmp = `${p}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, p);
}

// -------------------------
// Load Artists
// -------------------------
function extractArtistsArray(parsed) {
  if (!parsed) return [];

  if (Array.isArray(parsed)) return parsed;

  if (parsed && typeof parsed === "object") {
    const candidates = ["artists", "data", "items", "results", "list"];
    for (const k of candidates) {
      const v = parsed[k];
      if (Array.isArray(v)) return v;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        return Object.values(v);
      }
    }

    const vals = Object.values(parsed).filter((x) => x && typeof x === "object");
    if (vals.length) return vals;
  }

  return [];
}

function loadArtists() {
  const a = readJsonIfExists(ARTISTS_FILE_CANON);
  if (!a.ok) return { ok: false, artists: [], error: a.error };

  const rawArtists = extractArtistsArray(a.value);

  const normalized = rawArtists
    .map((x) => ({
      id: String(x?.id || "").trim(),
      name: x?.name ?? null,
      imageUrl: x?.imageUrl ?? null,
      genre: x?.genre ?? null,
      location: x?.location ?? null,
      status: x?.status ?? "active",
    }))
    .filter((x) => x.id);

  return { ok: true, artists: normalized };
}

// -------------------------
// Health Endpoint
// -------------------------
router.get("/health", async (_req, res) => {
  const artists = loadArtists();
  const medalTable = await loadMedalTableSafe();

  res.json({
    success: true,
    service: SERVICE,
    version: VERSION,
    updatedAt: nowIso(),
    artistsLoaded: artists.ok ? artists.artists.length : 0,
    medalCount: Object.keys(medalTable).length,
  });
});

// -------------------------
// Main Feed Endpoint
// -------------------------
router.get("/mix", async (req, res) => {
  const sessionId = String(req.query.sessionId || "").trim() || "anon";

  const artistsLoad = loadArtists();
  if (!artistsLoad.ok) {
    return res.status(500).json({
      success: false,
      message: "Artists file not available.",
      error: artistsLoad.error,
      updatedAt: nowIso(),
    });
  }

  // Load medals once per request
  const medalTable = await loadMedalTableSafe();

  const results = artistsLoad.artists.map((artist) => ({
    artist: {
      ...artist,
      medal: medalTable?.[artist.id] || null,
    },
    score: 0,
    baseScore: 0,
    multipliers: { personalization: 1, fatigue: 1 },
    lastAt: null,
    metrics: {},
    source: "ranked",
    explain: { sessionId },
  }));

  return res.json({
    success: true,
    version: VERSION,
    updatedAt: nowIso(),
    sessionId,
    count: results.length,
    results,
  });
});

export default router;