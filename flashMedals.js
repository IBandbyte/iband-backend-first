/**
 * flashMedals.js (root) — ESM default export
 * iBand Flash Medals Engine (v4) — Phase G1 Live Feed
 *
 * Flash medals = temporary 24h achievements (fan + artist).
 *
 * Endpoints (mounted at /api/flash-medals):
 * - GET  /health
 * - GET  /live?windowHours=24&limit=50&scope=all|artists|fans
 * - GET  /artist/:artistId?windowHours=24
 * - GET  /fan/:sessionId?windowHours=24
 * - GET  /countdown?windowHours=24
 *
 * Captain’s Protocol:
 * - Render-safe, tail-read only
 * - Wrapper-aware artists loader
 * - Always JSON, never breaks
 */

import express from "express";
import fs from "fs/promises";
import path from "path";

const router = express.Router();

// -------------------- Config --------------------
const SERVICE = "flash-medals";
const VERSION = 4;
const PATCH = "4.0-live-feed";

const DATA_DIR = process.env.DATA_DIR || "/var/data/iband/db";
const ARTISTS_FILE = process.env.ARTISTS_FILE || path.join(DATA_DIR, "artists.json");
const EVENTS_LOG_FILE = process.env.EVENTS_LOG_FILE || path.join(DATA_DIR, "events.jsonl");

// Windows / limits
const DEFAULT_WINDOW_HOURS = parseFloat(process.env.FLASH_WINDOW_HOURS || "24");
const MAX_WINDOW_HOURS = parseFloat(process.env.FLASH_MAX_WINDOW_HOURS || "72");
const MAX_RETURN = parseInt(process.env.FLASH_MAX_RETURN || "50", 10);

// Tail-reading controls (Render-safe)
const TAIL_KB = parseInt(process.env.FLASH_TAIL_KB || "512", 10);
const MAX_LINES = parseInt(process.env.FLASH_MAX_LINES || "3000", 10);

// Short cache to avoid re-parsing per-request
const CACHE_TTL_MS = parseInt(process.env.FLASH_CACHE_TTL_MS || "15000", 10);

// Thresholds (tunable)
const THRESH_FAN_MIN_VOTES = parseInt(process.env.FLASH_FAN_MIN_VOTES || "1", 10);
const THRESH_FAN_MIN_SHARES = parseInt(process.env.FLASH_FAN_MIN_SHARES || "0", 10);
const THRESH_FAN_MIN_LIKES = parseInt(process.env.FLASH_FAN_MIN_LIKES || "0", 10);

const THRESH_ARTIST_BREAKOUT_MIN_VOTES = parseInt(process.env.FLASH_ARTIST_BREAKOUT_MIN_VOTES || "1", 10);
const THRESH_ARTIST_VIRAL_MIN_SHARES = parseInt(process.env.FLASH_ARTIST_VIRAL_MIN_SHARES || "1", 10);

// Flash medals catalogue (extend later)
const FLASH_MEDALS = {
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

function parseWindowHours(q) {
  const w = safeNumber(q, DEFAULT_WINDOW_HOURS);
  const safe = clamp(w, 0.1, MAX_WINDOW_HOURS);
  return Number(safe.toFixed(6));
}

function withinWindow(atIso, windowHours) {
  const t = Date.parse(atIso);
  if (!Number.isFinite(t)) return false;
  const now = Date.now();
  const maxAgeMs = windowHours * 60 * 60 * 1000;
  return now - t <= maxAgeMs;
}

function normalizeType(t) {
  const x = String(t || "").toLowerCase().trim();
  return x || null;
}

// -------------------- File helpers --------------------
async function statSafe(p) {
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

// Wrapper-aware artists extraction (same “winning pattern” as recs.js)
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
    if (vals.length && !("id" in parsed && "name" in parsed)) {
      if (vals.length > 1) return vals;
      if (vals.length === 1 && typeof vals[0] === "object") return vals;
    }
  }
  return [];
}

async function loadArtists() {
  const base = { version: 1, updatedAt: null, artists: [] };
  const parsed = await readJsonSafe(ARTISTS_FILE, base);
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

  return { ok: true, artists: normalized, byId };
}

// Read last N KB from file, parse JSONL lines safely
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

      return { ok: true, events, lines: tail.length, error: null };
    } finally {
      await fh.close();
    }
  } catch (e) {
    return { ok: false, events: [], lines: 0, error: e?.code || String(e) };
  }
}

// -------------------- Flash medal computation --------------------
function computeCountdown(windowHours) {
  // Countdown is based on “server time now + window”, not user’s last event.
  // Frontend uses this as the global timer for the flash window period.
  const serverTime = new Date();
  const expiresAt = new Date(serverTime.getTime() + windowHours * 60 * 60 * 1000);
  const secondsRemaining = Math.max(0, Math.floor((expiresAt.getTime() - serverTime.getTime()) / 1000));

  return {
    success: true,
    serverTime: serverTime.toISOString(),
    windowHours,
    expiresAt: expiresAt.toISOString(),
    secondsRemaining,
  };
}

function summarizeForArtist(events, windowHours) {
  const byArtist = {};

  for (const ev of events) {
    const at = ev?.at;
    if (!at || !withinWindow(at, windowHours)) continue;

    const type = normalizeType(ev?.type);
    const artistId = String(ev?.artistId || "").trim();
    if (!type || !artistId) continue;

    if (!byArtist[artistId]) {
      byArtist[artistId] = {
        artistId,
        lastAt: at,
        vote: 0,
        share: 0,
        like: 0,
        view: 0,
        watchMs: 0,
        events: 0,
      };
    }

    const row = byArtist[artistId];
    row.events += 1;

    if (!row.lastAt || Date.parse(at) > Date.parse(row.lastAt)) row.lastAt = at;

    if (type === "vote") row.vote += 1;
    else if (type === "share") row.share += 1;
    else if (type === "like") row.like += 1;
    else if (type === "view") row.view += 1;

    const wm = safeNumber(ev?.watchMs, 0);
    if (wm > 0) row.watchMs += wm;
  }

  return byArtist;
}

function summarizeForFans(events, windowHours) {
  const bySession = {};

  for (const ev of events) {
    const at = ev?.at;
    if (!at || !withinWindow(at, windowHours)) continue;

    const type = normalizeType(ev?.type);
    const sid = String(ev?.sessionId || "").trim();
    if (!sid || !type) continue;

    if (!bySession[sid]) {
      bySession[sid] = {
        sessionId: sid,
        lastAt: at,
        votes: 0,
        likes: 0,
        shares: 0,
      };
    }

    const row = bySession[sid];
    if (!row.lastAt || Date.parse(at) > Date.parse(row.lastAt)) row.lastAt = at;

    if (type === "vote") row.votes += 1;
    else if (type === "like") row.likes += 1;
    else if (type === "share") row.shares += 1;
  }

  return bySession;
}

function pickArtistMedal(stats) {
  const votes = safeNumber(stats?.vote, 0);
  const shares = safeNumber(stats?.share, 0);

  // Priority: Viral if shares hit, else Breakout if votes hit
  if (shares >= THRESH_ARTIST_VIRAL_MIN_SHARES) return FLASH_MEDALS.artistViral;
  if (votes >= THRESH_ARTIST_BREAKOUT_MIN_VOTES) return FLASH_MEDALS.artistBreakout;

  return null;
}

function pickFanMedal(stats) {
  const votes = safeNumber(stats?.votes, 0);
  const shares = safeNumber(stats?.shares, 0);
  const likes = safeNumber(stats?.likes, 0);

  const okVotes = votes >= THRESH_FAN_MIN_VOTES;
  const okShares = shares >= THRESH_FAN_MIN_SHARES;
  const okLikes = likes >= THRESH_FAN_MIN_LIKES;

  if (okVotes && okShares && okLikes) return FLASH_MEDALS.fanPowerVoter;
  return null;
}

// -------------------- Live feed formatting --------------------
function messageForArtist(artist, medal) {
  const name = artist?.name || "Artist";
  if (medal?.code === "artist_viral") return `🚀 ${name} is going viral! Viral Lift unlocked.`;
  if (medal?.code === "artist_breakout") return `⚡ ${name} is surging! Breakout Surge unlocked.`;
  return `🔥 ${name} unlocked a flash medal!`;
}

function messageForFan(sessionId, medal) {
  const sid = sessionId || "fan";
  if (medal?.code === "fan_power_voter") return `🗳️ Power Voter unlocked! (${sid})`;
  return `🔥 Flash medal unlocked! (${sid})`;
}

function buildLiveFeed({ artistsRows, fansRows, artistsById, windowHours, limit, scope }) {
  const items = [];

  if (scope === "all" || scope === "artists") {
    for (const r of artistsRows) {
      const a = artistsById?.[r.artistId] || null;
      const medal = pickArtistMedal(r);
      if (!medal) continue;

      items.push({
        type: "artist",
        at: r.lastAt || null,
        subjectId: r.artistId,
        medal,
        message: messageForArtist(a, medal),
        stats: {
          vote: r.vote || 0,
          share: r.share || 0,
          like: r.like || 0,
          view: r.view || 0,
          watchMs: r.watchMs || 0,
          events: r.events || 0,
        },
        artist: a
          ? {
              id: a.id,
              name: a.name,
              genre: a.genre,
              location: a.location,
              imageUrl: a.imageUrl,
            }
          : { id: r.artistId, name: null, genre: null, location: null, imageUrl: null },
      });
    }
  }

  if (scope === "all" || scope === "fans") {
    for (const r of fansRows) {
      const medal = pickFanMedal(r);
      if (!medal) continue;

      items.push({
        type: "fan",
        at: r.lastAt || null,
        subjectId: r.sessionId,
        medal,
        message: messageForFan(r.sessionId, medal),
        stats: {
          votes: r.votes || 0,
          likes: r.likes || 0,
          shares: r.shares || 0,
        },
      });
    }
  }

  items.sort((a, b) => (Date.parse(b.at || "") || 0) - (Date.parse(a.at || "") || 0));

  const countdown = computeCountdown(windowHours);

  return {
    success: true,
    updatedAt: nowIso(),
    windowHours,
    expiresAt: countdown.expiresAt,
    secondsRemaining: countdown.secondsRemaining,
    count: items.length,
    results: items.slice(0, limit),
  };
}

// -------------------- Cache --------------------
let CACHE = {
  atMs: 0,
  key: "",
  payload: null,
};

function cacheKey({ windowHours, limit, scope }) {
  return `${windowHours}|${limit}|${scope}`;
}

// -------------------- Endpoints --------------------
router.use(express.json({ limit: "64kb" }));

router.get("/health", async (_req, res) => {
  const artistsStat = await statSafe(ARTISTS_FILE);
  const eventsStat = await statSafe(EVENTS_LOG_FILE);

  // lightweight tail parse for diagnostics
  const tail = await readJsonlTail(EVENTS_LOG_FILE, TAIL_KB, MAX_LINES);

  const artistsLoad = await loadArtists();

  return res.json({
    success: true,
    service: SERVICE,
    version: VERSION,
    patch: PATCH,
    updatedAt: nowIso(),
    sources: {
      dataDir: DATA_DIR,
      artistsFile: ARTISTS_FILE,
      eventsLog: EVENTS_LOG_FILE,
      artistsLoaded: artistsLoad.ok ? artistsLoad.artists.length : 0,
      eventsOk: tail.ok,
      eventsLines: tail.lines,
      error: tail.ok ? null : tail.error,
    },
    config: {
      windowHours: DEFAULT_WINDOW_HOURS,
      maxReturn: MAX_RETURN,
      medals: {
        artistViral: FLASH_MEDALS.artistViral,
        artistBreakout: FLASH_MEDALS.artistBreakout,
        fanPowerVoter: FLASH_MEDALS.fanPowerVoter,
      },
      thresholds: {
        fanPowerVoter: {
          minVotes: THRESH_FAN_MIN_VOTES,
          minShares: THRESH_FAN_MIN_SHARES,
          minLikes: THRESH_FAN_MIN_LIKES,
        },
        artist: {
          breakoutMinVotes: THRESH_ARTIST_BREAKOUT_MIN_VOTES,
          viralMinShares: THRESH_ARTIST_VIRAL_MIN_SHARES,
        },
      },
      limits: {
        defaultWindowHours: DEFAULT_WINDOW_HOURS,
        maxWindowHours: MAX_WINDOW_HOURS,
        tailKb: TAIL_KB,
        maxLines: MAX_LINES,
        maxReturn: MAX_RETURN,
        cacheTtlMs: CACHE_TTL_MS,
      },
      files: {
        artists: { path: ARTISTS_FILE, stat: artistsStat },
        events: { path: EVENTS_LOG_FILE, stat: eventsStat },
      },
    },
  });
});

router.get("/countdown", async (req, res) => {
  const windowHours = parseWindowHours(req.query.windowHours);
  return res.json(computeCountdown(windowHours));
});

/**
 * Phase G1: Live Feed
 * - Returns recent flash unlocks (artists + fans)
 * - Sorted by lastAt desc
 */
router.get("/live", async (req, res) => {
  const windowHours = parseWindowHours(req.query.windowHours);
  const limit = clamp(parseInt(req.query.limit || `${MAX_RETURN}`, 10) || MAX_RETURN, 1, MAX_RETURN);

  const scopeRaw = String(req.query.scope || "all").toLowerCase().trim();
  const scope = ["all", "artists", "fans"].includes(scopeRaw) ? scopeRaw : "all";

  const key = cacheKey({ windowHours, limit, scope });
  const nowMs = Date.now();

  if (CACHE.payload && CACHE.key === key && nowMs - CACHE.atMs <= CACHE_TTL_MS) {
    return res.json({ ...CACHE.payload, cached: true, cacheAgeMs: nowMs - CACHE.atMs });
  }

  const artistsLoad = await loadArtists();
  const tail = await readJsonlTail(EVENTS_LOG_FILE, TAIL_KB, MAX_LINES);

  const events = tail.ok ? tail.events : [];
  const byArtist = summarizeForArtist(events, windowHours);
  const byFan = summarizeForFans(events, windowHours);

  const artistsRows = Object.values(byArtist || {});
  const fansRows = Object.values(byFan || {});

  const payload = buildLiveFeed({
    artistsRows,
    fansRows,
    artistsById: artistsLoad.byId || {},
    windowHours,
    limit,
    scope,
  });

  payload.tail = { file: path.basename(EVENTS_LOG_FILE), ok: tail.ok, linesParsed: tail.lines, error: tail.error || null };

  CACHE = { atMs: nowMs, key, payload };

  return res.json({ ...payload, cached: false, cacheAgeMs: 0 });
});

router.get("/artist/:artistId", async (req, res) => {
  const windowHours = parseWindowHours(req.query.windowHours);
  const artistId = String(req.params.artistId || "").trim();
  if (!artistId) return res.status(400).json({ success: false, message: "artistId is required." });

  const artistsLoad = await loadArtists();
  const tail = await readJsonlTail(EVENTS_LOG_FILE, TAIL_KB, MAX_LINES);

  const events = tail.ok ? tail.events : [];
  const byArtist = summarizeForArtist(events, windowHours);
  const row = byArtist?.[artistId] || null;

  if (!row) {
    return res.json({
      success: true,
      updatedAt: nowIso(),
      windowHours,
      artistId,
      found: false,
      medal: null,
      lastAt: null,
      stats: { vote: 0, share: 0, view: 0, like: 0, watchMs: 0, events: 0 },
      artist: artistsLoad.byId?.[artistId] || null,
    });
  }

  const medal = pickArtistMedal(row);

  return res.json({
    success: true,
    updatedAt: nowIso(),
    windowHours,
    artistId,
    found: !!medal,
    medal,
    lastAt: row.lastAt || null,
    stats: { vote: row.vote, share: row.share, view: row.view, like: row.like, watchMs: row.watchMs, events: row.events },
    artist: artistsLoad.byId?.[artistId] || null,
  });
});

router.get("/fan/:sessionId", async (req, res) => {
  const windowHours = parseWindowHours(req.query.windowHours);
  const sessionId = String(req.params.sessionId || "").trim();
  if (!sessionId) return res.status(400).json({ success: false, message: "sessionId is required." });

  const tail = await readJsonlTail(EVENTS_LOG_FILE, TAIL_KB, MAX_LINES);
  const events = tail.ok ? tail.events : [];
  const byFan = summarizeForFans(events, windowHours);
  const row = byFan?.[sessionId] || null;

  if (!row) {
    return res.json({
      success: true,
      updatedAt: nowIso(),
      windowHours,
      sessionId,
      found: false,
      medal: null,
      lastAt: null,
      stats: { votes: 0, likes: 0, shares: 0 },
    });
  }

  const medal = pickFanMedal(row);

  return res.json({
    success: true,
    updatedAt: nowIso(),
    windowHours,
    sessionId,
    found: !!medal,
    medal,
    lastAt: row.lastAt || null,
    stats: { votes: row.votes, likes: row.likes, shares: row.shares },
  });
});

export default router;