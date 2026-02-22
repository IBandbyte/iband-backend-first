/**
 * flashMedals.js (root) — ESM default export
 * iBand Flash Medals Engine (v1.1)
 *
 * Goal:
 * - "Flash medals" that last for a short rolling window (default 24h)
 * - Awarded to BOTH artists + fans (by sessionId) based on events.jsonl
 * - Query-controlled windowHours for testing (safe clamped)
 *
 * Endpoints:
 * - GET  /api/flash-medals/health
 * - GET  /api/flash-medals/today?windowHours=24&limit=50
 *
 * Notes:
 * - Render-safe: reads tail of events.jsonl only (no full file load)
 * - Never breaks: if events missing, returns empty arrays with ok=false tail
 * - Strict JSON responses always
 */

import express from "express";
import fs from "fs/promises";
import path from "path";

const router = express.Router();

// -------------------- Env / Paths --------------------
const DATA_DIR = process.env.DATA_DIR || "/var/data/iband/db";
const ARTISTS_FILE = process.env.ARTISTS_FILE || path.join(DATA_DIR, "artists.json");
const EVENTS_LOG_FILE = process.env.EVENTS_LOG_FILE || path.join(DATA_DIR, "events.jsonl");

// Defaults
const SERVICE = "flash-medals";
const VERSION = 2; // v1.1

const DEFAULT_WINDOW_HOURS = Number(process.env.FLASH_MEDALS_WINDOW_HOURS || 24);
const MAX_WINDOW_HOURS = Number(process.env.FLASH_MEDALS_MAX_WINDOW_HOURS || 72);
const MIN_WINDOW_HOURS = Number(process.env.FLASH_MEDALS_MIN_WINDOW_HOURS || 0.1);

const MAX_RETURN = parseInt(process.env.FLASH_MEDALS_MAX_RETURN || "50", 10);

// Tail reading (Render-safe)
const TAIL_KB = parseInt(process.env.FLASH_MEDALS_TAIL_KB || "512", 10);
const MAX_LINES = parseInt(process.env.FLASH_MEDALS_MAX_LINES || "4000", 10);

// Thresholds (tunable)
const FAN_POWER_VOTER_MIN_VOTES = parseInt(process.env.FLASH_FAN_POWER_VOTER_MIN_VOTES || "1", 10);
const ARTIST_BREAKOUT_MIN_VOTES = parseInt(process.env.FLASH_ARTIST_BREAKOUT_MIN_VOTES || "1", 10);
const ARTIST_VIRAL_MIN_SHARES = parseInt(process.env.FLASH_ARTIST_VIRAL_MIN_SHARES || "1", 10);
const ARTIST_VIRAL_MIN_VIEWS = parseInt(process.env.FLASH_ARTIST_VIRAL_MIN_VIEWS || "0", 10);

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

function normalizeType(t) {
  const x = String(t || "").trim().toLowerCase();
  return x || null;
}

function withinWindow(atIso, windowHours) {
  const t = Date.parse(atIso);
  if (!Number.isFinite(t)) return false;
  const now = Date.now();
  const maxAgeMs = windowHours * 60 * 60 * 1000;
  return now - t <= maxAgeMs;
}

async function statOk(p) {
  try {
    const s = await fs.stat(p);
    return { ok: true, size: s.size, mtimeMs: s.mtimeMs };
  } catch (e) {
    return { ok: false, error: e?.code || String(e) };
  }
}

async function readJsonSafe(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// Wrapper-aware artists extractor (same spirit as recs.js)
function extractArtistsArray(parsed) {
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
    // keyed object at top-level
    const vals = Object.values(parsed).filter((x) => x && typeof x === "object");
    if (vals.length && !(("id" in parsed) && ("name" in parsed))) return vals;
  }

  return [];
}

async function loadArtistsById() {
  const base = null;
  const parsed = await readJsonSafe(ARTISTS_FILE, base);
  const arr = extractArtistsArray(parsed);

  const byId = {};
  for (const a of arr) {
    const id = String(a?.id || "").trim();
    if (!id) continue;
    byId[id] = {
      id,
      name: a?.name ?? null,
      imageUrl: a?.imageUrl ?? null,
      genre: a?.genre ?? null,
      location: a?.location ?? null,
      status: a?.status ?? "active",
    };
  }
  return { byId, count: Object.keys(byId).length };
}

// Read last N KB from JSONL, parse lines safely (Render-safe)
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
          // ignore
        }
      }

      return { ok: true, events, lines: tail.length, error: null };
    } finally {
      await fh.close();
    }
  } catch (e) {
    return { ok: false, events: [], lines: 0, error: e?.code || String(e) };
  }
}

// -------------------- Core: compute flash medals --------------------
function buildFlashFromEvents(events, artistsById, windowHours) {
  const byArtist = {};
  const byFan = {}; // by sessionId

  for (const ev of events) {
    const at = ev?.at;
    if (!at || !withinWindow(at, windowHours)) continue;

    const type = normalizeType(ev?.type);
    if (!type) continue;

    const artistId = String(ev?.artistId || "").trim() || null;
    const sessionId = String(ev?.sessionId || "").trim() || null;

    // --- Artist stats ---
    if (artistId) {
      if (!byArtist[artistId]) {
        byArtist[artistId] = {
          artistId,
          lastAt: at,
          vote: 0,
          share: 0,
          view: 0,
          like: 0,
          watchMs: 0,
          events: 0,
        };
      }

      const a = byArtist[artistId];
      a.events += 1;
      if (!a.lastAt || Date.parse(at) > Date.parse(a.lastAt)) a.lastAt = at;

      const wm = safeNumber(ev?.watchMs, 0);
      if (wm > 0) a.watchMs += wm;

      if (type === "vote") a.vote += 1;
      else if (type === "share") a.share += 1;
      else if (type === "view") a.view += 1;
      else if (type === "like") a.like += 1;
    }

    // --- Fan stats (sessionId) ---
    if (sessionId) {
      if (!byFan[sessionId]) {
        byFan[sessionId] = {
          sessionId,
          lastAt: at,
          votes: 0,
          likes: 0,
          shares: 0,
        };
      }

      const f = byFan[sessionId];
      if (!f.lastAt || Date.parse(at) > Date.parse(f.lastAt)) f.lastAt = at;

      if (type === "vote") f.votes += 1;
      else if (type === "like") f.likes += 1;
      else if (type === "share") f.shares += 1;
    }
  }

  // --- Award medals (artists) ---
  const artists = Object.values(byArtist).map((row) => {
    const artist = artistsById[row.artistId] || null;

    // Decide medal:
    // Priority: Viral Lift (share dominance), else Breakout Surge (vote activity)
    let medal = null;

    const qualifiesViral =
      row.share >= ARTIST_VIRAL_MIN_SHARES && row.view >= ARTIST_VIRAL_MIN_VIEWS;

    const qualifiesBreakout = row.vote >= ARTIST_BREAKOUT_MIN_VOTES;

    if (qualifiesViral) medal = MEDALS.artistViral;
    else if (qualifiesBreakout) medal = MEDALS.artistBreakout;

    return {
      artistId: row.artistId,
      medal,
      lastAt: row.lastAt || null,
      stats: {
        vote: row.vote,
        share: row.share,
        view: row.view,
        like: row.like,
        watchMs: row.watchMs,
        events: row.events,
      },
      artist: artist
        ? {
            id: artist.id,
            name: artist.name,
            imageUrl: artist.imageUrl,
            genre: artist.genre,
            location: artist.location,
          }
        : null,
    };
  });

  // Sort artists: medal first, then most shares, then votes, then lastAt
  artists.sort((a, b) => {
    const aHas = a.medal ? 1 : 0;
    const bHas = b.medal ? 1 : 0;
    if (bHas !== aHas) return bHas - aHas;
    if ((b.stats.share || 0) !== (a.stats.share || 0)) return (b.stats.share || 0) - (a.stats.share || 0);
    if ((b.stats.vote || 0) !== (a.stats.vote || 0)) return (b.stats.vote || 0) - (a.stats.vote || 0);
    return Date.parse(b.lastAt || 0) - Date.parse(a.lastAt || 0);
  });

  const artistsWithMedals = artists.filter((x) => x.medal);

  // --- Award medals (fans) ---
  const fans = Object.values(byFan).map((row) => {
    let medal = null;
    if (row.votes >= FAN_POWER_VOTER_MIN_VOTES) medal = MEDALS.fanPowerVoter;

    return {
      sessionId: row.sessionId,
      medal,
      lastAt: row.lastAt || null,
      stats: {
        votes: row.votes,
        likes: row.likes,
        shares: row.shares,
      },
    };
  });

  // Sort fans: medal first, then votes, then lastAt
  fans.sort((a, b) => {
    const aHas = a.medal ? 1 : 0;
    const bHas = b.medal ? 1 : 0;
    if (bHas !== aHas) return bHas - aHas;
    if ((b.stats.votes || 0) !== (a.stats.votes || 0)) return (b.stats.votes || 0) - (a.stats.votes || 0);
    return Date.parse(b.lastAt || 0) - Date.parse(a.lastAt || 0);
  });

  const fansWithMedals = fans.filter((x) => x.medal);

  return {
    artists: artistsWithMedals,
    fans: fansWithMedals,
  };
}

// -------------------- Endpoints --------------------
router.use(express.json({ limit: "64kb" }));

router.get("/health", async (_req, res) => {
  const artistsStat = await statOk(ARTISTS_FILE);
  const eventsStat = await statOk(EVENTS_LOG_FILE);

  // Tail read (best effort)
  const tail = await readJsonlTail(EVENTS_LOG_FILE, TAIL_KB, MAX_LINES);

  const artistsLoad = await loadArtistsById();

  return res.json({
    success: true,
    service: SERVICE,
    version: 1,
    updatedAt: nowIso(),
    sources: {
      dataDir: DATA_DIR,
      artistsFile: ARTISTS_FILE,
      eventsLog: EVENTS_LOG_FILE,
      artistsLoaded: artistsLoad.count,
      eventsOk: tail.ok,
      eventsLines: tail.lines,
      error: tail.ok ? null : tail.error,
      stat: {
        artists: artistsStat,
        events: eventsStat,
      },
    },
    config: {
      windowHours: DEFAULT_WINDOW_HOURS,
      maxReturn: MAX_RETURN,
      minWindowHours: MIN_WINDOW_HOURS,
      maxWindowHours: MAX_WINDOW_HOURS,
      tailKb: TAIL_KB,
      maxLines: MAX_LINES,
      thresholds: {
        fanPowerVoterMinVotes: FAN_POWER_VOTER_MIN_VOTES,
        artistBreakoutMinVotes: ARTIST_BREAKOUT_MIN_VOTES,
        artistViralMinShares: ARTIST_VIRAL_MIN_SHARES,
        artistViralMinViews: ARTIST_VIRAL_MIN_VIEWS,
      },
      medals: MEDALS,
    },
  });
});

router.get("/today", async (req, res) => {
  const windowHoursRaw = safeNumber(req.query.windowHours, DEFAULT_WINDOW_HOURS);
  const windowHours = clamp(windowHoursRaw, MIN_WINDOW_HOURS, MAX_WINDOW_HOURS);

  const limitRaw = parseInt(String(req.query.limit || MAX_RETURN), 10);
  const limit = clamp(Number.isFinite(limitRaw) ? limitRaw : MAX_RETURN, 1, MAX_RETURN);

  const tail = await readJsonlTail(EVENTS_LOG_FILE, TAIL_KB, MAX_LINES);
  const artistsLoad = await loadArtistsById();

  const computed = buildFlashFromEvents(tail.events || [], artistsLoad.byId, windowHours);

  return res.json({
    success: true,
    updatedAt: nowIso(),
    windowHours,
    tail: {
      file: path.basename(EVENTS_LOG_FILE),
      ok: tail.ok,
      linesParsed: tail.lines,
      error: tail.ok ? null : tail.error,
    },
    artists: (computed.artists || []).slice(0, limit),
    fans: (computed.fans || []).slice(0, limit),
  });
});

export default router;