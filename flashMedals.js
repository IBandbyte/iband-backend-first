// flashMedals.js
// iBand Backend — Flash Medals Engine (Phase F) — ESM default export
//
// Goals:
// - 24h “Flash Medals” for artists + fans (retention + competition)
// - Render-safe: tail-read events.jsonl, never load huge files
// - Always JSON responses
// - Canonical endpoints:
//   - GET /api/flash-medals/health
//   - GET /api/flash-medals/list?windowHours=24&limit=50
//   - GET /api/flash-medals/artist/:artistId?windowHours=24
//   - GET /api/flash-medals/fan/:sessionId?windowHours=24
//   - GET /api/flash-medals/countdown?windowHours=24
//
// Notes:
// - “Flash medals” expire on a rolling basis: windowHours from server time.
// - We return countdown info so frontend can show “time left” + “Vote locked” messaging later.
// - Medals are meant to be fun + immediate, not “global rank medals” (those are medals.js).

import express from "express";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";

const router = express.Router();

const SERVICE = "flash-medals";
const VERSION = 3; // Phase F: adds artist/fan routes + list route + countdown + canonical responses

// -------------------- Env / Paths --------------------
const DATA_DIR = process.env.IBAND_DATA_DIR || "/var/data/iband/db";
const ARTISTS_FILE = path.join(DATA_DIR, "artists.json");
const EVENTS_LOG = process.env.IBAND_EVENTS_LOG || path.join(DATA_DIR, "events.jsonl");

// -------------------- Limits / Defaults --------------------
const LIMITS = {
  defaultWindowHours: clampNum(process.env.FLASH_WINDOW_HOURS, 24, 0.1, 72),
  maxWindowHours: clampNum(process.env.FLASH_MAX_WINDOW_HOURS, 72, 1, 168),
  tailKb: clampInt(process.env.FLASH_TAIL_KB, 512, 16, 4096),
  maxLines: clampInt(process.env.FLASH_MAX_LINES, 3000, 100, 20000),
  maxReturn: clampInt(process.env.FLASH_MAX_RETURN, 50, 1, 200),
};

// Threshold tuning (simple now; can expand later)
const THRESHOLDS = {
  fanPowerVoter: {
    minVotes: clampInt(process.env.FLASH_FAN_MIN_VOTES, 1, 1, 50),
    minShares: clampInt(process.env.FLASH_FAN_MIN_SHARES, 0, 0, 50),
    minLikes: clampInt(process.env.FLASH_FAN_MIN_LIKES, 0, 0, 50),
  },
  artist: {
    breakoutMinVotes: clampInt(process.env.FLASH_ARTIST_BREAKOUT_MIN_VOTES, 1, 1, 9999),
    viralMinShares: clampInt(process.env.FLASH_ARTIST_VIRAL_MIN_SHARES, 1, 1, 9999),
  },
};

// Flash medal definitions (frontend-ready)
const MEDALS = {
  artistViral: { tier: "flash", code: "artist_viral", label: "Viral Lift", emoji: "🚀" },
  artistBreakout: { tier: "flash", code: "artist_breakout", label: "Breakout Surge", emoji: "⚡" },
  fanPowerVoter: { tier: "flash", code: "fan_power_voter", label: "Power Voter", emoji: "🗳️" },
};

// -------------------- Utils --------------------
function nowIso() {
  return new Date().toISOString();
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function clampInt(v, def, min, max) {
  const n = parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return def;
  return clamp(n, min, max);
}

function clampNum(v, def, min, max) {
  const n = parseFloat(String(v ?? ""));
  if (!Number.isFinite(n)) return def;
  return clamp(n, min, max);
}

function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

async function statOk(p) {
  try {
    const s = await fsp.stat(p);
    return { ok: true, size: s.size, mtimeMs: s.mtimeMs };
  } catch (e) {
    return { ok: false, error: e?.code || String(e) };
  }
}

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

function loadArtistsSync() {
  try {
    if (!fs.existsSync(ARTISTS_FILE)) return { ok: false, artists: [], error: "ENOENT" };
    const raw = fs.readFileSync(ARTISTS_FILE, "utf8");
    const parsed = safeJsonParse(raw, null);
    if (!parsed) return { ok: false, artists: [], error: "EJSONPARSE" };

    const arr = extractArtistsArray(parsed);
    const normalized = arr
      .map((x) => ({
        id: String(x?.id || "").trim(),
        name: x?.name ?? null,
        genre: x?.genre ?? null,
        location: x?.location ?? null,
        bio: x?.bio ?? null,
        imageUrl: x?.imageUrl ?? null,
        socials: x?.socials ?? null,
        tracks: Array.isArray(x?.tracks) ? x.tracks : [],
        status: x?.status ?? "active",
        createdAt: x?.createdAt ?? null,
        updatedAt: x?.updatedAt ?? null,
      }))
      .filter((a) => a.id);

    const byId = {};
    for (const a of normalized) byId[a.id] = a;

    return { ok: true, artists: normalized, byId, error: null };
  } catch (e) {
    return { ok: false, artists: [], byId: {}, error: e?.message || "EREAD" };
  }
}

// Tail-read last N KB of jsonl file (Render-safe)
function tailJsonlLines(filePath, tailKb, maxLines) {
  try {
    if (!fs.existsSync(filePath)) return { ok: false, lines: [], error: "ENOENT" };

    const stat = fs.statSync(filePath);
    const size = stat.size;
    const bytes = Math.min(size, Math.max(8 * 1024, tailKb * 1024));

    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(bytes);
    fs.readSync(fd, buf, 0, bytes, size - bytes);
    fs.closeSync(fd);

    const text = buf.toString("utf8");
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const tail = lines.slice(-maxLines);
    return { ok: true, lines: tail, error: null };
  } catch (e) {
    return { ok: false, lines: [], error: e?.message || "ETAIL" };
  }
}

function normalizeType(t) {
  const x = String(t || "").toLowerCase().trim();
  return x || null;
}

function withinWindow(atIso, windowHours, nowMs) {
  const t = Date.parse(atIso);
  if (!Number.isFinite(t)) return false;
  const maxAgeMs = windowHours * 60 * 60 * 1000;
  return nowMs - t <= maxAgeMs;
}

// Build per-artist and per-fan stats inside window
function buildWindowStatsFromEvents(events, windowHours) {
  const nowMs = Date.now();

  const byArtist = {};
  const byFan = {}; // by sessionId (fan identity in MVP)

  for (const ev of events) {
    const at = ev?.at;
    if (!at || !withinWindow(at, windowHours, nowMs)) continue;

    const type = normalizeType(ev?.type);
    if (!type) continue;

    const artistId = String(ev?.artistId || "").trim() || null;
    const sessionId = String(ev?.sessionId || "").trim() || null;
    const watchMs = Number(ev?.watchMs || 0) || 0;

    // Artist stats
    if (artistId) {
      if (!byArtist[artistId]) {
        byArtist[artistId] = { artistId, events: 0, vote: 0, share: 0, like: 0, view: 0, watchMs: 0, lastAt: null };
      }
      const a = byArtist[artistId];
      a.events += 1;
      if (!a.lastAt || Date.parse(at) > Date.parse(a.lastAt)) a.lastAt = at;

      if (type === "vote") a.vote += 1;
      else if (type === "share") a.share += 1;
      else if (type === "like") a.like += 1;
      else if (type === "view") a.view += 1;

      if (watchMs > 0) a.watchMs += watchMs;
    }

    // Fan stats (MVP: use sessionId)
    if (sessionId) {
      if (!byFan[sessionId]) {
        byFan[sessionId] = { sessionId, votes: 0, likes: 0, shares: 0, lastAt: null };
      }
      const f = byFan[sessionId];
      if (!f.lastAt || Date.parse(at) > Date.parse(f.lastAt)) f.lastAt = at;

      if (type === "vote") f.votes += 1;
      else if (type === "like") f.likes += 1;
      else if (type === "share") f.shares += 1;
    }
  }

  return { byArtist, byFan };
}

// Medal assignment logic (simple + expandable)
function medalForArtist(stats) {
  // Priority: Viral if share threshold hit
  if ((stats?.share || 0) >= THRESHOLDS.artist.viralMinShares) return MEDALS.artistViral;
  // Otherwise Breakout if votes threshold hit
  if ((stats?.vote || 0) >= THRESHOLDS.artist.breakoutMinVotes) return MEDALS.artistBreakout;
  return null;
}

function medalForFan(stats) {
  const okVotes = (stats?.votes || 0) >= THRESHOLDS.fanPowerVoter.minVotes;
  const okShares = (stats?.shares || 0) >= THRESHOLDS.fanPowerVoter.minShares;
  const okLikes = (stats?.likes || 0) >= THRESHOLDS.fanPowerVoter.minLikes;

  if (okVotes && okShares && okLikes) return MEDALS.fanPowerVoter;
  return null;
}

// Countdown: when does current flash window end?
// We align to “now + windowHours” as a rolling window for MVP.
// (Later we can align to midnight UTC or daily reset for leaderboards.)
function computeCountdown(windowHours) {
  const now = new Date();
  const nowMs = now.getTime();
  const expiresMs = nowMs + windowHours * 60 * 60 * 1000;
  const secondsRemaining = Math.max(0, Math.round((expiresMs - nowMs) / 1000));

  return {
    serverTime: now.toISOString(),
    windowHours,
    expiresAt: new Date(expiresMs).toISOString(),
    secondsRemaining,
  };
}

// Parse jsonl lines -> event objects
function parseEvents(lines) {
  const events = [];
  for (const ln of lines) {
    const obj = safeJsonParse(ln, null);
    if (!obj || typeof obj !== "object") continue;
    if (!obj.type || !obj.at) continue;
    // artistId/sessionId can be null; we still accept event (some are anonymous)
    events.push(obj);
  }
  return events;
}

// Build result payloads (sorted by lastAt desc)
function buildArtistResults(byArtist, artistsById, limit) {
  const rows = [];
  for (const [artistId, stats] of Object.entries(byArtist || {})) {
    const medal = medalForArtist(stats);
    if (!medal) continue;

    rows.push({
      artistId,
      medal,
      lastAt: stats.lastAt || null,
      stats: {
        vote: stats.vote || 0,
        share: stats.share || 0,
        like: stats.like || 0,
        view: stats.view || 0,
        watchMs: stats.watchMs || 0,
        events: stats.events || 0,
        lastAt: stats.lastAt || null,
      },
      artist: artistsById?.[artistId]
        ? artistsById[artistId]
        : { id: artistId, name: null, imageUrl: null, genre: null, location: null },
    });
  }

  rows.sort((a, b) => (Date.parse(b.lastAt || 0) || 0) - (Date.parse(a.lastAt || 0) || 0));
  return rows.slice(0, limit);
}

function buildFanResults(byFan, limit) {
  const rows = [];
  for (const [sessionId, stats] of Object.entries(byFan || {})) {
    const medal = medalForFan(stats);
    if (!medal) continue;

    rows.push({
      sessionId,
      medal,
      lastAt: stats.lastAt || null,
      stats: {
        votes: stats.votes || 0,
        likes: stats.likes || 0,
        shares: stats.shares || 0,
        lastAt: stats.lastAt || null,
      },
    });
  }

  rows.sort((a, b) => (Date.parse(b.lastAt || 0) || 0) - (Date.parse(a.lastAt || 0) || 0));
  return rows.slice(0, limit);
}

function getWindowHoursFromReq(req) {
  const q = req?.query?.windowHours;
  const win = clampNum(q, LIMITS.defaultWindowHours, 0.1, LIMITS.maxWindowHours);
  return win;
}

function getLimitFromReq(req) {
  const q = req?.query?.limit;
  const lim = clampInt(q, LIMITS.maxReturn, 1, LIMITS.maxReturn);
  return lim;
}

// -------------------- Endpoints --------------------

// Health: show sources + config
router.get("/health", async (_req, res) => {
  const artistsStat = await statOk(ARTISTS_FILE);
  const eventsStat = await statOk(EVENTS_LOG);

  // minimal load
  const artistsLoad = loadArtistsSync();
  const tail = tailJsonlLines(EVENTS_LOG, LIMITS.tailKb, LIMITS.maxLines);

  res.json({
    success: true,
    service: SERVICE,
    version: VERSION,
    updatedAt: nowIso(),
    sources: {
      dataDir: DATA_DIR,
      artistsFile: ARTISTS_FILE,
      eventsLog: EVENTS_LOG,
      artistsLoaded: artistsLoad.ok ? artistsLoad.artists.length : 0,
      eventsOk: tail.ok,
      eventsLines: tail.ok ? tail.lines.length : 0,
      error: artistsLoad.ok ? null : artistsLoad.error,
    },
    config: {
      windowHours: LIMITS.defaultWindowHours,
      maxReturn: LIMITS.maxReturn,
      medals: MEDALS,
      thresholds: THRESHOLDS,
      limits: LIMITS,
    },
    files: {
      artists: { path: ARTISTS_FILE, stat: artistsStat },
      events: { path: EVENTS_LOG, stat: eventsStat },
    },
  });
});

// Countdown helper for UI
router.get("/countdown", (req, res) => {
  const windowHours = getWindowHoursFromReq(req);
  return res.json({ success: true, ...computeCountdown(windowHours) });
});

// List: artists + fans
router.get(["/", "/list"], (req, res) => {
  const windowHours = getWindowHoursFromReq(req);
  const limit = getLimitFromReq(req);

  const artistsLoad = loadArtistsSync();
  const tail = tailJsonlLines(EVENTS_LOG, LIMITS.tailKb, LIMITS.maxLines);

  if (!artistsLoad.ok) {
    return res.status(500).json({
      success: false,
      message: "Artists file not available.",
      error: artistsLoad.error,
      updatedAt: nowIso(),
    });
  }

  if (!tail.ok) {
    return res.status(500).json({
      success: false,
      message: "Events log not available.",
      error: tail.error,
      updatedAt: nowIso(),
    });
  }

  const events = parseEvents(tail.lines);
  const { byArtist, byFan } = buildWindowStatsFromEvents(events, windowHours);

  const artists = buildArtistResults(byArtist, artistsLoad.byId, limit);
  const fans = buildFanResults(byFan, limit);

  return res.json({
    success: true,
    updatedAt: nowIso(),
    windowHours,
    tail: { file: path.basename(EVENTS_LOG), ok: tail.ok, linesParsed: tail.lines.length, error: tail.error || null },
    artists,
    fans,
  });
});

// Single artist flash medal (for “badge under artist name” + UI)
router.get("/artist/:artistId", (req, res) => {
  const windowHours = getWindowHoursFromReq(req);
  const artistId = String(req.params.artistId || "").trim();

  if (!artistId) {
    return res.status(400).json({ success: false, message: "artistId is required." });
  }

  const artistsLoad = loadArtistsSync();
  const tail = tailJsonlLines(EVENTS_LOG, LIMITS.tailKb, LIMITS.maxLines);

  if (!artistsLoad.ok) {
    return res.status(500).json({
      success: false,
      message: "Artists file not available.",
      error: artistsLoad.error,
      updatedAt: nowIso(),
    });
  }

  if (!tail.ok) {
    return res.status(500).json({
      success: false,
      message: "Events log not available.",
      error: tail.error,
      updatedAt: nowIso(),
    });
  }

  const events = parseEvents(tail.lines);
  const { byArtist } = buildWindowStatsFromEvents(events, windowHours);
  const stats = byArtist?.[artistId] || null;

  const medal = stats ? medalForArtist(stats) : null;

  return res.json({
    success: true,
    updatedAt: nowIso(),
    windowHours,
    artistId,
    found: Boolean(stats),
    medal: medal || null,
    lastAt: stats?.lastAt || null,
    stats: stats
      ? {
          vote: stats.vote || 0,
          share: stats.share || 0,
          view: stats.view || 0,
          like: stats.like || 0,
          watchMs: stats.watchMs || 0,
          events: stats.events || 0,
        }
      : null,
    artist: artistsLoad.byId?.[artistId] || { id: artistId, name: null, imageUrl: null, genre: null, location: null },
  });
});

// Single fan flash medal (fan “stardom” + podium triggers)
router.get("/fan/:sessionId", (req, res) => {
  const windowHours = getWindowHoursFromReq(req);
  const sessionId = String(req.params.sessionId || "").trim();

  if (!sessionId) {
    return res.status(400).json({ success: false, message: "sessionId is required." });
  }

  const tail = tailJsonlLines(EVENTS_LOG, LIMITS.tailKb, LIMITS.maxLines);

  if (!tail.ok) {
    return res.status(500).json({
      success: false,
      message: "Events log not available.",
      error: tail.error,
      updatedAt: nowIso(),
    });
  }

  const events = parseEvents(tail.lines);
  const { byFan } = buildWindowStatsFromEvents(events, windowHours);
  const stats = byFan?.[sessionId] || null;
  const medal = stats ? medalForFan(stats) : null;

  return res.json({
    success: true,
    updatedAt: nowIso(),
    windowHours,
    sessionId,
    found: Boolean(stats),
    medal: medal || null,
    lastAt: stats?.lastAt || null,
    stats: stats
      ? {
          votes: stats.votes || 0,
          likes: stats.likes || 0,
          shares: stats.shares || 0,
        }
      : null,
  });
});

export default router;