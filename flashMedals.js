// flashMedals.js
// iBand Backend — Flash Medals Engine (Phase E)
// Root-level router: mounted at /api/flash-medals
//
// Purpose:
// - Daily "Flash Medals" that last 24 hours (fan retention + artist competition)
// - Uses events.jsonl (real behavior), Render-safe, always returns JSON
// - No DB required (file-backed like the rest of iBand backend)
//
// Endpoints:
// - GET  /api/flash-medals/health
// - GET  /api/flash-medals/today
// - GET  /api/flash-medals/artists
// - GET  /api/flash-medals/fans
//
// Captain’s Protocol: full canonical, future-proof, Render-safe, always JSON.

import fs from "fs";
import path from "path";
import express from "express";

const router = express.Router();

// -------------------------
// Config
// -------------------------
const SERVICE = "flash-medals";
const VERSION = 1;

const DATA_DIR = process.env.IBAND_DATA_DIR || "/var/data/iband/db";
const EVENTS_LOG = process.env.IBAND_EVENTS_LOG || path.join(DATA_DIR, "events.jsonl");
const ARTISTS_FILE = path.join(DATA_DIR, "artists.json");

// Engine defaults (tunable later via env if needed)
const DEFAULTS = {
  windowHours: 24,
  maxReturn: 50,

  // Medal names (copy-friendly for UI)
  medals: {
    artistViral: { tier: "flash", code: "artist_viral", label: "Viral Lift", emoji: "🚀" },
    artistBreakout: { tier: "flash", code: "artist_breakout", label: "Breakout Surge", emoji: "⚡" },
    fanPowerVoter: { tier: "flash", code: "fan_power_voter", label: "Power Voter", emoji: "🗳️" },
  },
};

// -------------------------
// Helpers
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

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function withinHours(atIso, hours) {
  const t = Date.parse(atIso);
  if (!Number.isFinite(t)) return false;
  const now = Date.now();
  const maxAgeMs = hours * 60 * 60 * 1000;
  return now - t <= maxAgeMs;
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

function readJsonlAll(filePath) {
  try {
    if (!fs.existsSync(filePath)) return { ok: false, events: [], error: "ENOENT", lines: 0 };

    const text = fs.readFileSync(filePath, "utf8");
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const events = [];
    for (const ln of lines) {
      const obj = safeJsonParse(ln, null);
      if (obj && typeof obj === "object") events.push(obj);
    }

    return { ok: true, events, error: null, lines: lines.length };
  } catch (e) {
    return { ok: false, events: [], error: e?.message || "EJSONL", lines: 0 };
  }
}

// Wrapper-safe artists extraction (matches recs.js pattern)
function extractArtistsArray(parsed) {
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed;

  if (parsed && typeof parsed === "object") {
    const candidates = ["artists", "data", "items", "results", "list"];
    for (const k of candidates) {
      const v = parsed[k];
      if (Array.isArray(v)) return v;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const maybeVals = Object.values(v).filter((x) => x && typeof x === "object");
        if (maybeVals.length) return maybeVals;
      }
    }

    const vals = Object.values(parsed).filter((x) => x && typeof x === "object");
    if (vals.length && !("id" in parsed && "name" in parsed)) return vals;
  }

  return [];
}

function loadArtistsMap() {
  const a = readJsonIfExists(ARTISTS_FILE);
  if (!a.ok) return { ok: false, byId: {}, error: a.error, loaded: 0 };

  const raw = extractArtistsArray(a.value);

  const byId = {};
  for (const x of raw) {
    const id = String(x?.id || "").trim();
    if (!id) continue;
    byId[id] = {
      id,
      name: x?.name ?? null,
      imageUrl: x?.imageUrl ?? null,
      genre: x?.genre ?? null,
      location: x?.location ?? null,
      status: x?.status ?? "active",
    };
  }

  return { ok: true, byId, error: null, loaded: Object.keys(byId).length };
}

// -------------------------
// Core stats builders
// -------------------------
function buildArtistStats(events, windowHours) {
  const byArtist = {};

  for (const ev of events) {
    const at = ev?.at;
    const artistId = String(ev?.artistId || "").trim();
    const type = String(ev?.type || "").toLowerCase().trim();

    if (!at || !artistId || !type) continue;
    if (!withinHours(at, windowHours)) continue;

    if (!byArtist[artistId]) {
      byArtist[artistId] = {
        artistId,
        events: 0,
        view: 0,
        like: 0,
        share: 0,
        vote: 0,
        watchMs: 0,
        lastAt: at,
      };
    }

    const row = byArtist[artistId];
    row.events += 1;

    if (!row.lastAt || Date.parse(at) > Date.parse(row.lastAt)) row.lastAt = at;

    if (type === "view") row.view += 1;
    else if (type === "like") row.like += 1;
    else if (type === "share") row.share += 1;
    else if (type === "vote") row.vote += 1;

    const wm = Number(ev?.watchMs || 0);
    if (Number.isFinite(wm) && wm > 0) row.watchMs += wm;
  }

  return byArtist;
}

function buildFanStats(events, windowHours) {
  // NOTE: we use sessionId as fan identity for now (Phase E)
  const byFan = {};

  for (const ev of events) {
    const at = ev?.at;
    const sid = String(ev?.sessionId || "").trim();
    const type = String(ev?.type || "").toLowerCase().trim();

    if (!at || !sid || !type) continue;
    if (!withinHours(at, windowHours)) continue;

    if (!byFan[sid]) {
      byFan[sid] = {
        sessionId: sid,
        votes: 0,
        likes: 0,
        shares: 0,
        lastAt: at,
      };
    }

    const row = byFan[sid];
    if (!row.lastAt || Date.parse(at) > Date.parse(row.lastAt)) row.lastAt = at;

    if (type === "vote") row.votes += 1;
    else if (type === "like") row.likes += 1;
    else if (type === "share") row.shares += 1;
  }

  return byFan;
}

// -------------------------
// Medal logic (Phase E)
// -------------------------
function computeArtistFlashWinners(artistStats) {
  // Two medals:
  // - Viral Lift: highest shares (24h)
  // - Breakout Surge: highest votes (24h)
  let topShare = null;
  let topVote = null;

  for (const row of Object.values(artistStats || {})) {
    if (!topShare || row.share > topShare.share) topShare = row;
    if (!topVote || row.vote > topVote.vote) topVote = row;
  }

  const winners = [];

  if (topShare && topShare.share > 0) {
    winners.push({
      artistId: topShare.artistId,
      medal: DEFAULTS.medals.artistViral,
      lastAt: topShare.lastAt || null,
      stats: {
        share: topShare.share,
        vote: topShare.vote,
        view: topShare.view,
        like: topShare.like,
        watchMs: topShare.watchMs,
        events: topShare.events,
      },
    });
  }

  if (topVote && topVote.vote > 0) {
    winners.push({
      artistId: topVote.artistId,
      medal: DEFAULTS.medals.artistBreakout,
      lastAt: topVote.lastAt || null,
      stats: {
        vote: topVote.vote,
        share: topVote.share,
        view: topVote.view,
        like: topVote.like,
        watchMs: topVote.watchMs,
        events: topVote.events,
      },
    });
  }

  return winners;
}

function computeFanFlashWinners(fanStats) {
  // One medal:
  // - Power Voter: highest votes in 24h
  let topVoter = null;

  for (const row of Object.values(fanStats || {})) {
    if (!topVoter || row.votes > topVoter.votes) topVoter = row;
  }

  const winners = [];
  if (topVoter && topVoter.votes > 0) {
    winners.push({
      sessionId: topVoter.sessionId,
      medal: DEFAULTS.medals.fanPowerVoter,
      lastAt: topVoter.lastAt || null,
      stats: {
        votes: topVoter.votes,
        likes: topVoter.likes,
        shares: topVoter.shares,
      },
    });
  }

  return winners;
}

// Attach artist mini-profile if present
function attachArtistProfiles(winners, artistsById) {
  return (winners || []).map((w) => {
    const a = artistsById?.[w.artistId] || null;
    return {
      ...w,
      artist: a
        ? { id: a.id, name: a.name, imageUrl: a.imageUrl, genre: a.genre, location: a.location }
        : null,
    };
  });
}

// -------------------------
// Routes
// -------------------------
router.get("/health", (_req, res) => {
  const artists = loadArtistsMap();
  const ev = readJsonlAll(EVENTS_LOG);

  res.json({
    success: true,
    service: SERVICE,
    version: VERSION,
    updatedAt: nowIso(),
    sources: {
      dataDir: DATA_DIR,
      artistsFile: ARTISTS_FILE,
      eventsLog: EVENTS_LOG,
      artistsLoaded: artists.ok ? artists.loaded : 0,
      eventsOk: ev.ok,
      eventsLines: ev.lines,
      error: !ev.ok ? ev.error : null,
    },
    config: {
      windowHours: DEFAULTS.windowHours,
      maxReturn: DEFAULTS.maxReturn,
      medals: DEFAULTS.medals,
    },
  });
});

router.get("/today", (_req, res) => {
  const artists = loadArtistsMap();
  const ev = readJsonlAll(EVENTS_LOG);

  const events = ev.ok ? ev.events : [];
  const artistStats = buildArtistStats(events, DEFAULTS.windowHours);
  const fanStats = buildFanStats(events, DEFAULTS.windowHours);

  const artistWinners = attachArtistProfiles(computeArtistFlashWinners(artistStats), artists.byId);
  const fanWinners = computeFanFlashWinners(fanStats);

  res.json({
    success: true,
    updatedAt: nowIso(),
    windowHours: DEFAULTS.windowHours,
    tail: {
      file: path.basename(EVENTS_LOG),
      ok: ev.ok,
      linesParsed: ev.lines,
      error: ev.ok ? null : ev.error,
    },
    artists: artistWinners.slice(0, DEFAULTS.maxReturn),
    fans: fanWinners.slice(0, DEFAULTS.maxReturn),
  });
});

router.get("/artists", (req, res) => {
  const limit = clamp(parseInt(req.query.limit || `${DEFAULTS.maxReturn}`, 10) || DEFAULTS.maxReturn, 1, DEFAULTS.maxReturn);

  const artists = loadArtistsMap();
  const ev = readJsonlAll(EVENTS_LOG);

  const events = ev.ok ? ev.events : [];
  const artistStats = buildArtistStats(events, DEFAULTS.windowHours);

  const winners = attachArtistProfiles(computeArtistFlashWinners(artistStats), artists.byId);

  res.json({
    success: true,
    updatedAt: nowIso(),
    count: winners.length,
    results: winners.slice(0, limit),
  });
});

router.get("/fans", (req, res) => {
  const limit = clamp(parseInt(req.query.limit || `${DEFAULTS.maxReturn}`, 10) || DEFAULTS.maxReturn, 1, DEFAULTS.maxReturn);

  const ev = readJsonlAll(EVENTS_LOG);
  const events = ev.ok ? ev.events : [];

  const fanStats = buildFanStats(events, DEFAULTS.windowHours);
  const winners = computeFanFlashWinners(fanStats);

  res.json({
    success: true,
    updatedAt: nowIso(),
    count: winners.length,
    results: winners.slice(0, limit),
  });
});

export default router;