// recs.js
// iBand Backend — Recs Mix (v6.3 Medal Safe Integration)
// Root-level router: mounted at /api/recs
//
// Step 6.3:
// - Fix ESM export mismatch
// - Use getMedalForArtist (existing export)
// - Inject medal safely per artist
//
// Captain’s Protocol: full canonical, future-proof, Render-safe, always JSON.

import fs from "fs";
import path from "path";
import crypto from "crypto";
import express from "express";
import { getMedalForArtist } from "./medals.js"; // ✅ FIXED

const router = express.Router();

const SERVICE = "recs-mix";
const VERSION = 27;

const DATA_DIR = process.env.IBAND_DATA_DIR || "/var/data/iband/db";
const ARTISTS_FILE_CANON = path.join(DATA_DIR, "artists.json");

// -------------------------
// Utilities
// -------------------------
function nowIso() {
  return new Date().toISOString();
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
    }
    return Object.values(parsed);
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
// Health
// -------------------------
router.get("/health", (_req, res) => {
  const artists = loadArtists();

  res.json({
    success: true,
    service: SERVICE,
    version: VERSION,
    updatedAt: nowIso(),
    artistsLoaded: artists.ok ? artists.artists.length : 0,
  });
});

// -------------------------
// Feed
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

  const results = [];

  for (const artist of artistsLoad.artists) {
    let medal = null;

    try {
      medal = await getMedalForArtist(artist.id);
    } catch {
      medal = null;
    }

    results.push({
      artist: {
        ...artist,
        medal,
      },
      score: 0,
      baseScore: 0,
      multipliers: { personalization: 1, fatigue: 1 },
      lastAt: null,
      metrics: {},
      source: "ranked",
      explain: { sessionId },
    });
  }

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