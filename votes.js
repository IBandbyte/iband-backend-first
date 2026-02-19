/**
 * votes.js — Phase A Voting System
 * 
 * Rules:
 * - Max 1 vote per artist per 24h per session
 * - Max 3 votes per category per 24h per session
 */

import express from "express";
import fs from "fs/promises";
import path from "path";

const router = express.Router();

const DATA_DIR = process.env.DATA_DIR || "/var/data/iband/db";
const EVENTS_FILE = path.join(DATA_DIR, "events.jsonl");
const ARTISTS_FILE = path.join(DATA_DIR, "artists.json");

const MAX_VOTES_PER_CATEGORY = 3;
const VOTE_COOLDOWN_HOURS = 24;

function hoursBetween(a, b) {
  return Math.abs(Date.parse(b) - Date.parse(a)) / (1000 * 60 * 60);
}

async function readJsonSafe(file, fallback) {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function readEvents() {
  try {
    const raw = await fs.readFile(EVENTS_FILE, "utf8");
    return raw
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => JSON.parse(l));
  } catch {
    return [];
  }
}

router.post("/", async (req, res) => {
  const { artistId, sessionId } = req.body;

  if (!artistId || !sessionId) {
    return res.status(400).json({
      success: false,
      message: "artistId and sessionId required"
    });
  }

  const artistsData = await readJsonSafe(ARTISTS_FILE, { artists: [] });
  const artist = artistsData.artists.find(a => a.id === artistId);

  if (!artist) {
    return res.status(404).json({
      success: false,
      message: "Artist not found"
    });
  }

  const events = await readEvents();
  const now = new Date().toISOString();

  const recentVotes = events.filter(e =>
    e.type === "vote" &&
    e.sessionId === sessionId &&
    hoursBetween(e.at, now) <= VOTE_COOLDOWN_HOURS
  );

  const votesForArtist = recentVotes.filter(e => e.artistId === artistId);
  if (votesForArtist.length >= 1) {
    return res.status(429).json({
      success: false,
      message: "You can only vote once per artist every 24 hours."
    });
  }

  const categoryVotes = recentVotes.filter(e => {
    const votedArtist = artistsData.artists.find(a => a.id === e.artistId);
    return votedArtist && votedArtist.category === artist.category;
  });

  if (categoryVotes.length >= MAX_VOTES_PER_CATEGORY) {
    return res.status(429).json({
      success: false,
      message: "You have used all 3 votes in this category today."
    });
  }

  const voteEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    at: now,
    type: "vote",
    artistId,
    sessionId,
    watchMs: 0,
    v: 1
  };

  await fs.appendFile(EVENTS_FILE, JSON.stringify(voteEvent) + "\n");

  return res.json({
    success: true,
    message: "Vote recorded.",
    voteEvent
  });
});

export default router;