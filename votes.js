/**
 * votes.js (root) — ESM default export
 * iBand Voting Engine (Phase C)
 *
 * Features:
 * - 1 vote per artist per 24h (per session)
 * - Category vote caps (default 3 per 24h per category)
 * - 5-minute undo window
 * - Vote removal recorded as event (never deletes history)
 * - Writes vote + vote_remove into events.jsonl
 * - Updates events-agg.json safely
 */

import express from "express";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const router = express.Router();

const DATA_DIR = process.env.DATA_DIR || "/var/data/iband/db";
const EVENTS_LOG_FILE = path.join(DATA_DIR, "events.jsonl");
const EVENTS_AGG_FILE = path.join(DATA_DIR, "events-agg.json");
const ARTISTS_FILE = path.join(DATA_DIR, "artists.json");

const VOTE_WINDOW_HOURS = 24;
const CATEGORY_CAP = 3;
const UNDO_MINUTES = 5;

function nowIso() {
  return new Date().toISOString();
}

function safeNumber(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function randomId() {
  return crypto.randomBytes(8).toString("hex");
}

async function readJsonSafe(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function appendJsonl(filePath, obj) {
  const line = JSON.stringify(obj) + "\n";
  await fs.appendFile(filePath, line, "utf8");
}

async function loadArtists() {
  const base = { artists: [] };
  const data = await readJsonSafe(ARTISTS_FILE, base);
  if (!Array.isArray(data.artists)) data.artists = [];
  return data.artists;
}

async function loadAgg() {
  const base = { version: 1, updatedAt: null, byArtist: {} };
  const data = await readJsonSafe(EVENTS_AGG_FILE, base);
  if (!data.byArtist) data.byArtist = {};
  return data;
}

async function saveAgg(data) {
  data.updatedAt = nowIso();
  await fs.writeFile(EVENTS_AGG_FILE, JSON.stringify(data, null, 2));
}

function hoursSince(iso) {
  const diff = Date.now() - Date.parse(iso);
  return diff / (1000 * 60 * 60);
}

function minutesSince(iso) {
  const diff = Date.now() - Date.parse(iso);
  return diff / (1000 * 60);
}

// -------------------- POST /vote --------------------
router.post("/vote", async (req, res) => {
  const artistId = String(req.body.artistId || "").trim();
  const sessionId = String(req.body.sessionId || "").trim();

  if (!artistId || !sessionId) {
    return res.status(400).json({ success: false, message: "artistId and sessionId required." });
  }

  const artists = await loadArtists();
  const artist = artists.find(a => a.id === artistId);
  if (!artist) {
    return res.status(404).json({ success: false, message: "Artist not found." });
  }

  const category = artist.genre || "general";

  const agg = await loadAgg();
  if (!agg.byArtist[artistId]) {
    agg.byArtist[artistId] = {
      votes: 0,
      lastAt: null
    };
  }

  // Read recent vote history from log
  const rawLog = await fs.readFile(EVENTS_LOG_FILE, "utf8").catch(() => "");
  const lines = rawLog.split("\n").filter(Boolean);

  let recentArtistVote = null;
  let categoryVotes = 0;

  for (let i = lines.length - 1; i >= 0; i--) {
    const ev = JSON.parse(lines[i]);
    if (ev.sessionId !== sessionId) continue;
    if (hoursSince(ev.at) > VOTE_WINDOW_HOURS) continue;

    if (ev.type === "vote") {
      if (ev.artistId === artistId) recentArtistVote = ev;

      const a = artists.find(x => x.id === ev.artistId);
      if (a && a.genre === category) categoryVotes++;
    }
  }

  if (recentArtistVote) {
    return res.status(429).json({
      success: false,
      message: "You already voted for this artist in last 24h."
    });
  }

  if (categoryVotes >= CATEGORY_CAP) {
    return res.status(429).json({
      success: false,
      message: `Category vote limit reached (${CATEGORY_CAP}/24h).`
    });
  }

  const event = {
    id: `evt_${Date.now()}_${randomId()}`,
    at: nowIso(),
    type: "vote",
    artistId,
    sessionId,
    watchMs: 0,
    v: 1
  };

  await appendJsonl(EVENTS_LOG_FILE, event);

  agg.byArtist[artistId].votes = safeNumber(agg.byArtist[artistId].votes) + 1;
  agg.byArtist[artistId].lastAt = event.at;

  await saveAgg(agg);

  return res.json({
    success: true,
    message: "Vote recorded.",
    voteEvent: event
  });
});

// -------------------- POST /vote/undo --------------------
router.post("/vote/undo", async (req, res) => {
  const artistId = String(req.body.artistId || "").trim();
  const sessionId = String(req.body.sessionId || "").trim();

  if (!artistId || !sessionId) {
    return res.status(400).json({ success: false, message: "artistId and sessionId required." });
  }

  const rawLog = await fs.readFile(EVENTS_LOG_FILE, "utf8").catch(() => "");
  const lines = rawLog.split("\n").filter(Boolean);

  let lastVote = null;

  for (let i = lines.length - 1; i >= 0; i--) {
    const ev = JSON.parse(lines[i]);
    if (ev.sessionId === sessionId && ev.artistId === artistId && ev.type === "vote") {
      lastVote = ev;
      break;
    }
  }

  if (!lastVote) {
    return res.status(404).json({ success: false, message: "No vote found to undo." });
  }

  if (minutesSince(lastVote.at) > UNDO_MINUTES) {
    return res.status(403).json({
      success: false,
      message: "Undo window expired (5 minutes)."
    });
  }

  const undoEvent = {
    id: `evt_${Date.now()}_${randomId()}`,
    at: nowIso(),
    type: "vote_remove",
    artistId,
    sessionId,
    watchMs: 0,
    v: -1
  };

  await appendJsonl(EVENTS_LOG_FILE, undoEvent);

  const agg = await loadAgg();
  if (agg.byArtist[artistId]) {
    agg.byArtist[artistId].votes = Math.max(
      0,
      safeNumber(agg.byArtist[artistId].votes) - 1
    );
  }

  await saveAgg(agg);

  return res.json({
    success: true,
    message: "Vote removed.",
    undoEvent
  });
});

export default router;