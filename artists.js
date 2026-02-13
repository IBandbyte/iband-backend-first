/**
 * artists.js (root)
 * Public Artists API
 * - GET  /api/artists
 * - GET  /api/artists/:id
 * - POST /api/artists/submit
 * - POST /api/artists/:id/vote   <-- added + hardened + persistent
 *
 * Notes:
 * - Storage auto-detects Render Disk at /var/data and uses: /var/data/iband/db
 * - Votes are rate-limited per artist per "voter fingerprint" (IP + UA) with cooldown window
 */

const express = require("express");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const router = express.Router();

/* ----------------------------- Storage paths ----------------------------- */

function hasRenderDisk() {
  // Render persistent disk mounts at /var/data (your setup)
  try {
    return fs.existsSync("/var/data") && fs.statSync("/var/data").isDirectory();
  } catch {
    return false;
  }
}

function getDbDir() {
  if (hasRenderDisk()) return path.join("/var/data", "iband", "db");
  // Ephemeral fallback (Render free / local dev)
  return path.join(process.cwd(), "db");
}

function getArtistsFile() {
  return path.join(getDbDir(), "artists.json");
}

function getVotesFile() {
  return path.join(getDbDir(), "votes.json");
}

async function ensureDb() {
  const dir = getDbDir();
  await fsp.mkdir(dir, { recursive: true });

  const artistsFile = getArtistsFile();
  const votesFile = getVotesFile();

  // Ensure artists.json exists
  try {
    await fsp.access(artistsFile);
  } catch {
    const seed = [
      {
        id: "demo",
        name: "Demo Artist",
        genre: "Pop / Urban",
        location: "London, UK",
        bio: "Demo artist used for initial platform validation.",
        imageUrl: "",
        socials: {
          instagram: "",
          tiktok: "",
          youtube: "",
          spotify: "",
          soundcloud: "",
          website: "",
        },
        tracks: [{ title: "Demo Track", url: "", platform: "mp3", durationSec: 30 }],
        votes: 42,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    await fsp.writeFile(artistsFile, JSON.stringify(seed, null, 2), "utf8");
  }

  // Ensure votes.json exists
  try {
    await fsp.access(votesFile);
  } catch {
    // votes.json structure:
    // {
    //   "artistId": {
    //     "voterHash": lastVoteISO
    //   }
    // }
    await fsp.writeFile(votesFile, JSON.stringify({}, null, 2), "utf8");
  }
}

async function readJson(file, fallback) {
  try {
    const raw = await fsp.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(file, data) {
  const tmp = `${file}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fsp.rename(tmp, file);
}

function nowISO() {
  return new Date().toISOString();
}

/* ------------------------------ Helpers -------------------------------- */

function safeStr(v) {
  return typeof v === "string" ? v.trim() : "";
}

function toInt(v, def) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

function makeId() {
  return crypto.randomUUID();
}

function getClientIp(req) {
  // Render / proxies usually set x-forwarded-for
  const xff = safeStr(req.headers["x-forwarded-for"]);
  if (xff) return xff.split(",")[0].trim();
  return safeStr(req.ip) || "unknown";
}

function getUserAgent(req) {
  return safeStr(req.headers["user-agent"]) || "unknown";
}

function voterFingerprint(req) {
  const ip = getClientIp(req);
  const ua = getUserAgent(req);
  return crypto.createHash("sha256").update(`${ip}|${ua}`).digest("hex");
}

/**
 * Vote cooldown window (ms)
 * Default: 6 hours (21600000 ms)
 * You can override via env: VOTE_COOLDOWN_MINUTES
 */
function getVoteCooldownMs() {
  const mins = toInt(process.env.VOTE_COOLDOWN_MINUTES, 360); // 6h default
  return Math.max(1, mins) * 60 * 1000;
}

/* ------------------------------- Routes -------------------------------- */

// Health-ish endpoint for quick sanity (optional, harmless)
router.get("/health", async (req, res) => {
  await ensureDb();
  return res.json({ success: true, message: "artists ok", ts: nowISO() });
});

/**
 * GET /api/artists
 * Query:
 *  - status=active|pending|hidden|all (default active)
 *  - q=search name/genre/location
 *  - page=1..n (default 1)
 *  - limit=1..100 (default 50)
 */
router.get("/", async (req, res) => {
  await ensureDb();

  const status = safeStr(req.query.status) || "active";
  const q = (safeStr(req.query.q) || "").toLowerCase();
  const page = Math.max(1, toInt(req.query.page, 1));
  const limit = Math.min(100, Math.max(1, toInt(req.query.limit, 50)));

  const artists = await readJson(getArtistsFile(), []);
  let filtered = Array.isArray(artists) ? artists : [];

  if (status !== "all") {
    filtered = filtered.filter((a) => (a.status || "active") === status);
  }

  if (q) {
    filtered = filtered.filter((a) => {
      const hay = `${a.name || ""} ${a.genre || ""} ${a.location || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  const total = filtered.length;
  const start = (page - 1) * limit;
  const slice = filtered.slice(start, start + limit);

  return res.json({
    success: true,
    count: slice.length,
    artists: slice,
    page,
    limit,
    total,
    status,
    q: safeStr(req.query.q) || "",
  });
});

/**
 * GET /api/artists/:id
 */
router.get("/:id", async (req, res) => {
  await ensureDb();

  const id = safeStr(req.params.id);
  const artists = await readJson(getArtistsFile(), []);
  const artist = (Array.isArray(artists) ? artists : []).find((a) => a.id === id);

  if (!artist) {
    return res.status(404).json({ success: false, message: "Artist not found." });
  }

  return res.json({ success: true, artist });
});

/**
 * POST /api/artists/submit
 * Public submit (pending approval)
 */
router.post("/submit", async (req, res) => {
  await ensureDb();

  const body = req.body || {};
  const name = safeStr(body.name);
  const genre = safeStr(body.genre);
  const location = safeStr(body.location);
  const bio = safeStr(body.bio);

  if (!name) return res.status(400).json({ success: false, message: "name is required." });

  const socials = body.socials && typeof body.socials === "object" ? body.socials : {};
  const tracks = Array.isArray(body.tracks) ? body.tracks : [];

  const artists = await readJson(getArtistsFile(), []);
  const list = Array.isArray(artists) ? artists : [];

  const artist = {
    id: makeId(),
    name,
    genre: genre || "",
    location: location || "",
    bio: bio || "",
    imageUrl: safeStr(body.imageUrl) || "",
    socials: {
      instagram: safeStr(socials.instagram) || "",
      tiktok: safeStr(socials.tiktok) || "",
      youtube: safeStr(socials.youtube) || "",
      spotify: safeStr(socials.spotify) || "",
      soundcloud: safeStr(socials.soundcloud) || "",
      website: safeStr(socials.website) || "",
    },
    tracks: tracks.map((t) => ({
      title: safeStr(t.title) || "",
      url: safeStr(t.url) || "",
      platform: safeStr(t.platform) || "mp3",
      durationSec: Math.max(0, toInt(t.durationSec, 0)),
    })),
    votes: 0,
    status: "pending",
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };

  list.unshift(artist);
  await writeJsonAtomic(getArtistsFile(), list);

  return res.status(201).json({
    success: true,
    message: "Artist submitted successfully (pending approval).",
    artist,
  });
});

/**
 * POST /api/artists/:id/vote
 * Public vote endpoint (NO admin key)
 *
 * Hardening:
 * - Only allows voting on active artists
 * - Cooldown per artist per voter fingerprint (IP + UA hash) default 6 hours
 * - Persists vote ledger to votes.json on Render Disk (/var/data/iband/db)
 *
 * Body: NONE (leave empty). Content-Type header is fine.
 */
router.post("/:id/vote", async (req, res) => {
  await ensureDb();

  const id = safeStr(req.params.id);
  const artists = await readJson(getArtistsFile(), []);
  const list = Array.isArray(artists) ? artists : [];

  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Artist not found." });

  const artist = list[idx];
  const status = artist.status || "active";
  if (status !== "active") {
    return res.status(409).json({
      success: false,
      message: "Voting is only allowed for active artists.",
      id,
      status,
    });
  }

  const votesLedger = await readJson(getVotesFile(), {});
  const ledger = votesLedger && typeof votesLedger === "object" ? votesLedger : {};

  const voterHash = voterFingerprint(req);
  const cooldownMs = getVoteCooldownMs();

  ledger[id] = ledger[id] && typeof ledger[id] === "object" ? ledger[id] : {};
  const last = ledger[id][voterHash];

  if (last) {
    const lastMs = Date.parse(last);
    if (Number.isFinite(lastMs)) {
      const elapsed = Date.now() - lastMs;
      if (elapsed < cooldownMs) {
        const retryAfterSec = Math.ceil((cooldownMs - elapsed) / 1000);
        res.set("Retry-After", String(retryAfterSec));
        return res.status(429).json({
          success: false,
          message: "Vote rate-limited. Please try again later.",
          id,
          retryAfterSec,
        });
      }
    }
  }

  // Record vote
  ledger[id][voterHash] = nowISO();
  await writeJsonAtomic(getVotesFile(), ledger);

  // Increment artist votes
  const currentVotes = Number.isFinite(Number(artist.votes)) ? Number(artist.votes) : 0;
  const newVotes = currentVotes + 1;

  list[idx] = {
    ...artist,
    votes: newVotes,
    updatedAt: nowISO(),
  };

  await writeJsonAtomic(getArtistsFile(), list);

  return res.status(201).json({
    success: true,
    message: "Vote recorded.",
    id,
    delta: 1,
    votes: newVotes,
    artist: {
      id: list[idx].id,
      name: list[idx].name,
      votes: list[idx].votes,
      status: list[idx].status,
      updatedAt: list[idx].updatedAt,
    },
  });
});

module.exports = router;