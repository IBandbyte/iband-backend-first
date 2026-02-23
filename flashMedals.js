// flashMedals.js
// iBand Backend — Flash Medal Engine + Countdown (Phase F)
// Captain’s Protocol: full canonical file

import fs from "fs";
import path from "path";
import express from "express";

const router = express.Router();

const SERVICE = "flash-medals";
const VERSION = 3;

// -------------------------------
// CONFIG
// -------------------------------

const DATA_DIR = process.env.IBAND_DATA_DIR || "/var/data/iband/db";
const EVENTS_LOG = path.join(DATA_DIR, "events.jsonl");
const ARTISTS_FILE = path.join(DATA_DIR, "artists.json");

const CONFIG = {
  windowHours: 24,
  maxWindowHours: 72,
  maxReturn: 50,
  tailKb: 512,
  maxLines: 3000,

  medals: {
    artistViral: {
      tier: "flash",
      code: "artist_viral",
      label: "Viral Lift",
      emoji: "🚀",
    },
    artistBreakout: {
      tier: "flash",
      code: "artist_breakout",
      label: "Breakout Surge",
      emoji: "⚡",
    },
    fanPowerVoter: {
      tier: "flash",
      code: "fan_power_voter",
      label: "Power Voter",
      emoji: "🗳️",
    },
  },

  thresholds: {
    fanPowerVoter: {
      minVotes: 1,
      minShares: 0,
      minLikes: 0,
    },
    artist: {
      breakoutMinVotes: 1,
      viralMinShares: 1,
    },
  },
};

// -------------------------------
// HELPERS
// -------------------------------

function nowIso() {
  return new Date().toISOString();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function readArtists() {
  try {
    const raw = fs.readFileSync(ARTISTS_FILE, "utf8");
    const json = JSON.parse(raw);

    if (Array.isArray(json)) return json;
    if (json.artists) return json.artists;

    return [];
  } catch {
    return [];
  }
}

function tailFile(filePath, kb, maxLines) {
  try {
    if (!fs.existsSync(filePath)) {
      return { ok: false, lines: [] };
    }

    const stat = fs.statSync(filePath);
    const size = stat.size;

    const readBytes = Math.min(size, kb * 1024);

    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(readBytes);

    fs.readSync(fd, buffer, 0, readBytes, size - readBytes);
    fs.closeSync(fd);

    const lines = buffer
      .toString("utf8")
      .split("\n")
      .filter(Boolean)
      .slice(-maxLines);

    return { ok: true, lines };
  } catch {
    return { ok: false, lines: [] };
  }
}

function parseEvents(lines) {
  const events = [];

  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.type) events.push(obj);
    } catch {}
  }

  return events;
}

function withinWindow(ts, hours) {
  const diff = Date.now() - Date.parse(ts);
  return diff <= hours * 3600000;
}

// -------------------------------
// BUILD MEDALS
// -------------------------------

function computeFlashMedals(events, artists, windowHours) {
  const artistStats = {};
  const fanStats = {};

  for (const ev of events) {
    if (!withinWindow(ev.at, windowHours)) continue;

    // artist
    if (ev.artistId) {
      if (!artistStats[ev.artistId]) {
        artistStats[ev.artistId] = {
          vote: 0,
          share: 0,
          like: 0,
          view: 0,
          watchMs: 0,
          events: 0,
          lastAt: ev.at,
        };
      }

      const s = artistStats[ev.artistId];

      s.events++;
      s.lastAt = ev.at;

      if (ev.type === "vote") s.vote++;
      if (ev.type === "share") s.share++;
      if (ev.type === "like") s.like++;
      if (ev.type === "view") s.view++;

      s.watchMs += Number(ev.watchMs || 0);
    }

    // fan
    if (ev.sessionId) {
      if (!fanStats[ev.sessionId]) {
        fanStats[ev.sessionId] = {
          votes: 0,
          likes: 0,
          shares: 0,
          lastAt: ev.at,
        };
      }

      const f = fanStats[ev.sessionId];

      if (ev.type === "vote") f.votes++;
      if (ev.type === "like") f.likes++;
      if (ev.type === "share") f.shares++;

      f.lastAt = ev.at;
    }
  }

  const artistResults = [];
  const fanResults = [];

  for (const id in artistStats) {
    const s = artistStats[id];

    if (s.share >= CONFIG.thresholds.artist.viralMinShares) {
      artistResults.push({
        artistId: id,
        medal: CONFIG.medals.artistViral,
        lastAt: s.lastAt,
        stats: s,
        artist: artists.find((a) => a.id === id) || null,
      });
      continue;
    }

    if (s.vote >= CONFIG.thresholds.artist.breakoutMinVotes) {
      artistResults.push({
        artistId: id,
        medal: CONFIG.medals.artistBreakout,
        lastAt: s.lastAt,
        stats: s,
        artist: artists.find((a) => a.id === id) || null,
      });
    }
  }

  for (const sid in fanStats) {
    const s = fanStats[sid];

    if (
      s.votes >= CONFIG.thresholds.fanPowerVoter.minVotes &&
      s.likes >= CONFIG.thresholds.fanPowerVoter.minLikes &&
      s.shares >= CONFIG.thresholds.fanPowerVoter.minShares
    ) {
      fanResults.push({
        sessionId: sid,
        medal: CONFIG.medals.fanPowerVoter,
        lastAt: s.lastAt,
        stats: s,
      });
    }
  }

  return { artists: artistResults, fans: fanResults };
}

// -------------------------------
// ROUTES
// -------------------------------

router.get("/health", (req, res) => {
  const artists = readArtists();
  const tail = tailFile(EVENTS_LOG, CONFIG.tailKb, CONFIG.maxLines);

  res.json({
    success: true,
    service: SERVICE,
    version: VERSION,
    updatedAt: nowIso(),
    sources: {
      dataDir: DATA_DIR,
      artistsFile: ARTISTS_FILE,
      eventsLog: EVENTS_LOG,
      artistsLoaded: artists.length,
      eventsOk: tail.ok,
      eventsLines: tail.lines.length,
    },
    config: CONFIG,
  });
});

// -------------------------------
// MAIN LIST
// -------------------------------

router.get("/", (req, res) => {
  const windowHours = clamp(
    Number(req.query.windowHours || CONFIG.windowHours),
    1,
    CONFIG.maxWindowHours
  );

  const artists = readArtists();

  const tail = tailFile(EVENTS_LOG, CONFIG.tailKb, CONFIG.maxLines);
  const events = parseEvents(tail.lines);

  const medals = computeFlashMedals(events, artists, windowHours);

  res.json({
    success: true,
    updatedAt: nowIso(),
    windowHours,
    tail: {
      file: "events.jsonl",
      ok: tail.ok,
      linesParsed: tail.lines.length,
    },
    artists: medals.artists.slice(0, CONFIG.maxReturn),
    fans: medals.fans.slice(0, CONFIG.maxReturn),
  });
});

// -------------------------------
// COUNTDOWN ENDPOINT
// -------------------------------

router.get("/timers", (req, res) => {
  const windowHours = clamp(
    Number(req.query.windowHours || CONFIG.windowHours),
    1,
    CONFIG.maxWindowHours
  );

  const expiresAt = Date.now() + windowHours * 3600000;

  res.json({
    success: true,
    serverTime: nowIso(),
    windowHours,
    expiresAt: new Date(expiresAt).toISOString(),
    secondsRemaining: Math.floor((expiresAt - Date.now()) / 1000),
  });
});

export default router;