/**
 * flashMedals.js (root) — ESM default export
 * iBand Flash Medals Engine (Phase E)
 *
 * Flash medals = temporary 24h achievements that boost retention + competition.
 *
 * Endpoints (mounted at /api/flash-medals):
 * - GET  /health
 * - GET  /now?windowHours=24&limit=50
 * - GET  /artist/:artistId?windowHours=24
 * - GET  /fan/:sessionId?windowHours=24
 * - GET  /            (alias of /now for convenience/back-compat)
 *
 * Render-safe:
 * - Reads only the last N KB of events.jsonl (tail), never loads full file
 * - Wrapper-aware artists.json loader
 *
 * Captain’s Protocol: full canonical, future-proof, always JSON.
 */

import express from "express";
import fs from "fs/promises";
import path from "path";

const router = express.Router();

// -------------------- Service / Version --------------------
const SERVICE = "flash-medals";
const VERSION = 2; // v2 adds /artist/:artistId and /fan/:sessionId routes

// -------------------- Paths / Env --------------------
const DATA_DIR = process.env.DATA_DIR || "/var/data/iband/db";
const ARTISTS_FILE = process.env.ARTISTS_FILE || path.join(DATA_DIR, "artists.json");
const EVENTS_LOG_FILE = process.env.EVENTS_LOG_FILE || path.join(DATA_DIR, "events.jsonl");

// Window controls
const DEFAULT_WINDOW_HOURS = parseFloat(process.env.FLASH_WINDOW_HOURS || "24");
const MAX_WINDOW_HOURS = parseFloat(process.env.FLASH_MAX_WINDOW_HOURS || "72");

// Tail-reading controls
const TAIL_KB = parseInt(process.env.FLASH_TAIL_KB || "512", 10);
const MAX_LINES = parseInt(process.env.FLASH_MAX_LINES || "3000", 10);

// Result controls
const MAX_RETURN = parseInt(process.env.FLASH_MAX_RETURN || "50", 10);

// Medal thresholds (tunable)
const FAN_POWER_VOTER_MIN_VOTES = parseInt(process.env.FLASH_FAN_POWER_VOTER_MIN_VOTES || "1", 10);
const FAN_POWER_VOTER_MIN_SHARES = parseInt(process.env.FLASH_FAN_POWER_VOTER_MIN_SHARES || "0", 10);
const FAN_POWER_VOTER_MIN_LIKES = parseInt(process.env.FLASH_FAN_POWER_VOTER_MIN_LIKES || "0", 10);

const ARTIST_BREAKOUT_MIN_VOTES = parseInt(process.env.FLASH_ARTIST_BREAKOUT_MIN_VOTES || "1", 10);
const ARTIST_VIRAL_MIN_SHARES = parseInt(process.env.FLASH_ARTIST_VIRAL_MIN_SHARES || "1", 10);

// -------------------- Medal Definitions --------------------
const MEDALS = {
  artistViral: { tier: "flash", code: "artist_viral", label: "Viral Lift", emoji: "🚀" },
  artistBreakout: { tier: "flash", code: "artist_breakout", label: "Breakout Surge", emoji: "⚡" },
  fanPowerVoter: { tier: "flash", code: "fan_power_voter", label: "Power Voter", emoji: "🗳️" },
};

// -------------------- Utils --------------------
function nowIso() {
  return new Date().toISOString();
}

function safeNumber(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalizeStr(s) {
  return String(s || "").trim();
}

function normalizeType(t) {
  const x = String(t || "").toLowerCase().trim();
  return x || null;
}

function withinWindow(atIso, windowHours) {
  const t = Date.parse(atIso);
  if (!Number.isFinite(t)) return false;
  const now = Date.now();
  const maxAgeMs = windowHours * 60 * 60 * 1000;
  return now - t <= maxAgeMs;
}

// -------------------- Safe JSON helpers --------------------
async function readJsonSafe(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function statSafe(filePath) {
  try {
    const s = await fs.stat(filePath);
    return { ok: true, size: s.size, mtimeMs: s.mtimeMs };
  } catch (e) {
    return { ok: false, error: e?.code || String(e) };
  }
}

// Wrapper-aware artists extraction
function extractArtistsArray(parsed) {
  // Supported:
  // 1) [ ...artists ]
  // 2) { artists:[...] }
  // 3) { success:true, artists:[...] }
  // 4) { data:[...] } / { items:[...] } / { results:[...] } / { list:[...] }
  // 5) keyed map { id1:{...}, id2:{...} } or { artists: { id1:{...} } }
  if (!parsed) return [];

  if (Array.isArray(parsed)) return parsed;

  if (parsed && typeof parsed === "object") {
    const candidates = ["artists", "data", "items", "results", "list"];
    for (const k of candidates) {
      const v = parsed[k];
      if (Array.isArray(v)) return v;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const vals = Object.values(v).filter((x) => x && typeof x === "object");
        if (vals.length) return vals;
      }
    }

    // keyed map at top level
    const vals = Object.values(parsed).filter((x) => x && typeof x === "object");
    // Guard against single-artist object
    if (vals.length && !(("id" in parsed) && ("name" in parsed))) return vals;
  }

  return [];
}

async function loadArtists() {
  const base = null;
  const parsed = await readJsonSafe(ARTISTS_FILE, base);
  const arr = extractArtistsArray(parsed);

  const normalized = arr
    .map((a) => ({
      id: normalizeStr(a?.id),
      name: a?.name ?? null,
      imageUrl: a?.imageUrl ?? null,
      genre: a?.genre ?? null,
      location: a?.location ?? null,
      status: a?.status ?? "active",
    }))
    .filter((a) => a.id);

  // index for quick lookup
  const byId = {};
  for (const a of normalized) byId[a.id] = a;

  return { ok: true, artists: normalized, byId };
}

// Render-safe tail reader for jsonl
async function readJsonlTail(filePath, tailKb, maxLines) {
  try {
    const s = await fs.stat(filePath);
    const size = s.size;
    const bytes = Math.min(size, Math.max(8 * 1024, tailKb * 1024));
    const fh = await fs.open(filePath, "r");
    try {
      const buf = Buffer.alloc(bytes);
      await fh.read(buf, 0, bytes, size - bytes);
      const text = buf.toString("utf8");

      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const tail = lines.slice(-maxLines);

      const events = [];
      for (const line of tail) {
        try {
          const obj = JSON.parse(line);
          if (obj && typeof obj === "object") events.push(obj);
        } catch {
          // ignore bad lines
        }
      }

      return { ok: true, events, linesParsed: tail.length, error: null };
    } finally {
      await fh.close();
    }
  } catch (e) {
    return { ok: false, events: [], linesParsed: 0, error: e?.code || String(e) };
  }
}

// -------------------- Window aggregation --------------------
function buildArtistWindow(events, windowHours) {
  const byArtist = {};

  for (const ev of events) {
    const at = ev?.at;
    if (!at || !withinWindow(at, windowHours)) continue;

    const type = normalizeType(ev?.type);
    const artistId = normalizeStr(ev?.artistId);
    if (!type || !artistId) continue;

    if (!byArtist[artistId]) {
      byArtist[artistId] = {
        artistId,
        lastAt: at,
        view: 0,
        replay: 0,
        like: 0,
        save: 0,
        share: 0,
        follow: 0,
        comment: 0,
        vote: 0,
        watchMs: 0,
        events: 0,
      };
    }

    const row = byArtist[artistId];
    row.events += 1;

    if (!row.lastAt || Date.parse(at) > Date.parse(row.lastAt)) row.lastAt = at;

    const wm = safeNumber(ev?.watchMs, 0);
    if (wm > 0) row.watchMs += wm;

    if (type === "view") row.view += 1;
    else if (type === "replay") row.replay += 1;
    else if (type === "like") row.like += 1;
    else if (type === "save") row.save += 1;
    else if (type === "share") row.share += 1;
    else if (type === "follow") row.follow += 1;
    else if (type === "comment") row.comment += 1;
    else if (type === "vote") row.vote += 1;
  }

  return byArtist;
}

function buildFanWindow(events, windowHours) {
  const byFan = {};

  for (const ev of events) {
    const at = ev?.at;
    if (!at || !withinWindow(at, windowHours)) continue;

    const type = normalizeType(ev?.type);
    const sessionId = normalizeStr(ev?.sessionId);
    if (!type || !sessionId) continue;

    if (!byFan[sessionId]) {
      byFan[sessionId] = {
        sessionId,
        lastAt: at,
        votes: 0,
        likes: 0,
        shares: 0,
      };
    }

    const row = byFan[sessionId];
    if (!row.lastAt || Date.parse(at) > Date.parse(row.lastAt)) row.lastAt = at;

    if (type === "vote") row.votes += 1;
    else if (type === "like") row.likes += 1;
    else if (type === "share") row.shares += 1;
  }

  return byFan;
}

// -------------------- Medal assignment --------------------
function pickArtistFlashMedal(stats) {
  // Priority: viral first, then breakout
  if ((stats.share || 0) >= ARTIST_VIRAL_MIN_SHARES) return MEDALS.artistViral;
  if ((stats.vote || 0) >= ARTIST_BREAKOUT_MIN_VOTES) return MEDALS.artistBreakout;
  return null;
}

function pickFanFlashMedal(stats) {
  const okVotes = (stats.votes || 0) >= FAN_POWER_VOTER_MIN_VOTES;
  const okShares = (stats.shares || 0) >= FAN_POWER_VOTER_MIN_SHARES;
  const okLikes = (stats.likes || 0) >= FAN_POWER_VOTER_MIN_LIKES;

  if (okVotes && okShares && okLikes) return MEDALS.fanPowerVoter;
  return null;
}

// -------------------- Core compute --------------------
async function computeFlash(windowHours, limit) {
  const wh = clamp(safeNumber(windowHours, DEFAULT_WINDOW_HOURS), 0.1, MAX_WINDOW_HOURS);
  const lim = clamp(parseInt(limit || `${MAX_RETURN}`, 10) || MAX_RETURN, 1, MAX_RETURN);

  const artistsLoad = await loadArtists();
  const tail = await readJsonlTail(EVENTS_LOG_FILE, TAIL_KB, MAX_LINES);

  const artistWin = buildArtistWindow(tail.events || [], wh);
  const fanWin = buildFanWindow(tail.events || [], wh);

  // Artists array
  const artists = [];
  for (const [artistId, stats] of Object.entries(artistWin)) {
    const medal = pickArtistFlashMedal(stats);
    if (!medal) continue;

    const artist = artistsLoad.byId?.[artistId] || null;

    artists.push({
      artistId,
      medal,
      lastAt: stats.lastAt || null,
      stats: {
        vote: safeNumber(stats.vote, 0),
        share: safeNumber(stats.share, 0),
        view: safeNumber(stats.view, 0),
        like: safeNumber(stats.like, 0),
        watchMs: safeNumber(stats.watchMs, 0),
        events: safeNumber(stats.events, 0),
      },
      artist: artist
        ? { id: artist.id, name: artist.name, imageUrl: artist.imageUrl, genre: artist.genre, location: artist.location }
        : null,
    });
  }

  // Order: most recent first (simple + predictable)
  artists.sort((a, b) => Date.parse(b.lastAt || 0) - Date.parse(a.lastAt || 0));

  // Fans array
  const fans = [];
  for (const [sessionId, stats] of Object.entries(fanWin)) {
    const medal = pickFanFlashMedal(stats);
    if (!medal) continue;

    fans.push({
      sessionId,
      medal,
      lastAt: stats.lastAt || null,
      stats: {
        votes: safeNumber(stats.votes, 0),
        likes: safeNumber(stats.likes, 0),
        shares: safeNumber(stats.shares, 0),
      },
    });
  }

  fans.sort((a, b) => Date.parse(b.lastAt || 0) - Date.parse(a.lastAt || 0));

  return {
    wh,
    tail,
    artistsLoaded: artistsLoad.artists.length,
    artists: artists.slice(0, lim),
    fans: fans.slice(0, lim),
    artistWin,
    fanWin,
  };
}

// -------------------- Routes --------------------
router.get("/health", async (_req, res) => {
  const artistsStat = await statSafe(ARTISTS_FILE);
  const eventsStat = await statSafe(EVENTS_LOG_FILE);

  // lightweight tail probe
  const tail = await readJsonlTail(EVENTS_LOG_FILE, TAIL_KB, Math.min(200, MAX_LINES));

  const artistsLoad = await loadArtists();

  return res.json({
    success: true,
    service: SERVICE,
    version: VERSION,
    updatedAt: nowIso(),
    sources: {
      dataDir: DATA_DIR,
      artistsFile: ARTISTS_FILE,
      eventsLog: EVENTS_LOG_FILE,
      artistsLoaded: artistsLoad.artists.length,
      eventsOk: tail.ok,
      eventsLines: tail.linesParsed,
      error: tail.error || null,
    },
    config: {
      windowHours: DEFAULT_WINDOW_HOURS,
      maxReturn: MAX_RETURN,
      medals: {
        artistViral: MEDALS.artistViral,
        artistBreakout: MEDALS.artistBreakout,
        fanPowerVoter: MEDALS.fanPowerVoter,
      },
      thresholds: {
        fanPowerVoter: {
          minVotes: FAN_POWER_VOTER_MIN_VOTES,
          minShares: FAN_POWER_VOTER_MIN_SHARES,
          minLikes: FAN_POWER_VOTER_MIN_LIKES,
        },
        artist: {
          breakoutMinVotes: ARTIST_BREAKOUT_MIN_VOTES,
          viralMinShares: ARTIST_VIRAL_MIN_SHARES,
        },
      },
      limits: {
        defaultWindowHours: DEFAULT_WINDOW_HOURS,
        maxWindowHours: MAX_WINDOW_HOURS,
        tailKb: TAIL_KB,
        maxLines: MAX_LINES,
        maxReturn: MAX_RETURN,
      },
    },
    files: {
      artists: { path: ARTISTS_FILE, stat: artistsStat },
      events: { path: EVENTS_LOG_FILE, stat: eventsStat },
    },
  });
});

// Main “now” view
router.get("/now", async (req, res) => {
  const windowHours = safeNumber(req.query.windowHours, DEFAULT_WINDOW_HOURS);
  const limit = req.query.limit || `${MAX_RETURN}`;

  const computed = await computeFlash(windowHours, limit);

  return res.json({
    success: true,
    updatedAt: nowIso(),
    windowHours: computed.wh,
    tail: {
      file: path.basename(EVENTS_LOG_FILE),
      ok: computed.tail.ok,
      linesParsed: computed.tail.linesParsed,
      error: computed.tail.error || null,
    },
    artists: computed.artists,
    fans: computed.fans,
  });
});

// Alias / -> /now (keeps life simple on mobile testing)
router.get("/", async (req, res) => {
  req.url = "/now" + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "");
  return router.handle(req, res);
});

// Single artist
router.get("/artist/:artistId", async (req, res) => {
  const artistId = normalizeStr(req.params.artistId);
  if (!artistId) return res.status(400).json({ success: false, message: "artistId is required." });

  const windowHours = safeNumber(req.query.windowHours, DEFAULT_WINDOW_HOURS);
  const computed = await computeFlash(windowHours, 1);

  const stats = computed.artistWin?.[artistId] || null;
  if (!stats) {
    return res.json({
      success: true,
      updatedAt: nowIso(),
      windowHours: computed.wh,
      artistId,
      found: false,
      medal: null,
      lastAt: null,
      stats: null,
      artist: computed?.artistWin ? (await loadArtists()).byId?.[artistId] || null : null,
    });
  }

  const medal = pickArtistFlashMedal(stats);
  const artistsLoad = await loadArtists();
  const artist = artistsLoad.byId?.[artistId] || null;

  return res.json({
    success: true,
    updatedAt: nowIso(),
    windowHours: computed.wh,
    artistId,
    found: true,
    medal: medal || null,
    lastAt: stats.lastAt || null,
    stats: {
      vote: safeNumber(stats.vote, 0),
      share: safeNumber(stats.share, 0),
      view: safeNumber(stats.view, 0),
      like: safeNumber(stats.like, 0),
      watchMs: safeNumber(stats.watchMs, 0),
      events: safeNumber(stats.events, 0),
    },
    artist: artist
      ? { id: artist.id, name: artist.name, imageUrl: artist.imageUrl, genre: artist.genre, location: artist.location }
      : null,
  });
});

// Single fan (sessionId)
router.get("/fan/:sessionId", async (req, res) => {
  const sessionId = normalizeStr(req.params.sessionId);
  if (!sessionId) return res.status(400).json({ success: false, message: "sessionId is required." });

  const windowHours = safeNumber(req.query.windowHours, DEFAULT_WINDOW_HOURS);
  const computed = await computeFlash(windowHours, 1);

  const stats = computed.fanWin?.[sessionId] || null;
  if (!stats) {
    return res.json({
      success: true,
      updatedAt: nowIso(),
      windowHours: computed.wh,
      sessionId,
      found: false,
      medal: null,
      lastAt: null,
      stats: null,
    });
  }

  const medal = pickFanFlashMedal(stats);

  return res.json({
    success: true,
    updatedAt: nowIso(),
    windowHours: computed.wh,
    sessionId,
    found: true,
    medal: medal || null,
    lastAt: stats.lastAt || null,
    stats: {
      votes: safeNumber(stats.votes, 0),
      likes: safeNumber(stats.likes, 0),
      shares: safeNumber(stats.shares, 0),
    },
  });
});

export default router;