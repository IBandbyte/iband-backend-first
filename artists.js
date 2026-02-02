// artists.js (ROOT)
// iBand Artists Router (PUBLIC + SAFE)
// - Fixes Render crash: removes "await import('crypto')" usage
// - Consistent response shape: { success, count, artists } and { success, artist }
// - Public list supports status + q search
// - Public submit defaults to pending
// - Includes a seeded demo artist ("demo") if none exist

import express from "express";
import { randomUUID } from "crypto";

const router = express.Router();

/* -----------------------------
   In-memory store (persists per instance)
----------------------------- */
const store =
  globalThis.__IBAND_STORE__ ||
  (globalThis.__IBAND_STORE__ = {
    artists: [],
  });

/* -----------------------------
   Helpers
----------------------------- */
function safeText(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function normStatus(v) {
  const s = safeText(v).trim().toLowerCase();
  if (s === "active" || s === "pending" || s === "rejected") return s;
  return "";
}

function nowISO() {
  return new Date().toISOString();
}

function seedIfEmpty() {
  if (Array.isArray(store.artists) && store.artists.length > 0) return;

  store.artists.push({
    id: "demo",
    name: "Demo Artist",
    genre: "Pop / Urban",
    location: "London, UK",
    bio: "Demo artist used for initial platform validation.",
    imageUrl: "",
    socials: {},
    tracks: [],
    votes: 42,
    status: "pending",
    createdAt: nowISO(),
    updatedAt: nowISO(),
  });
}

function matchesQ(artist, q) {
  const query = safeText(q).trim().toLowerCase();
  if (!query) return true;

  const hay = [
    artist?.name,
    artist?.genre,
    artist?.location,
    artist?.bio,
    artist?.status,
  ]
    .map((x) => safeText(x).toLowerCase())
    .join(" ");

  return hay.includes(query);
}

function sanitizeArtistInput(payload = {}) {
  const name = safeText(payload.name).trim();
  const genre = safeText(payload.genre).trim();
  const location = safeText(payload.location).trim();
  const bio = safeText(payload.bio).trim();

  const imageUrl = safeText(payload.imageUrl).trim();

  const socials =
    payload && typeof payload.socials === "object" && payload.socials
      ? payload.socials
      : {};

  const tracks = Array.isArray(payload.tracks) ? payload.tracks : [];

  // Public default is pending
  const status = normStatus(payload.status) || "pending";

  return { name, genre, location, bio, imageUrl, socials, tracks, status };
}

function requireName(payload) {
  const name = safeText(payload?.name).trim();
  return name.length >= 2;
}

/* -----------------------------
   Routes
----------------------------- */

// Health-ish quick route
router.get("/ping", (req, res) => {
  return res.json({
    success: true,
    message: "artists router ok",
  });
});

// LIST: GET /api/artists?status=active&q=bad
router.get("/", (req, res) => {
  seedIfEmpty();

  const status = normStatus(req.query.status) || "active";
  const q = safeText(req.query.q);

  // Public list: filter by status (default active)
  const filtered = store.artists
    .filter((a) => normStatus(a.status) === status)
    .filter((a) => matchesQ(a, q));

  return res.json({
    success: true,
    count: filtered.length,
    artists: filtered,
  });
});

// GET ONE: GET /api/artists/:id
router.get("/:id", (req, res) => {
  seedIfEmpty();

  const id = safeText(req.params.id).trim();
  const artist = store.artists.find((a) => safeText(a.id) === id);

  if (!artist) {
    return res.status(404).json({
      success: false,
      message: "Artist not found",
    });
  }

  return res.json({
    success: true,
    artist,
  });
});

// SUBMIT/CREATE: POST /api/artists
router.post("/", (req, res) => {
  seedIfEmpty();

  const payload = req.body || {};

  if (!requireName(payload)) {
    return res.status(400).json({
      success: false,
      message: "Name is required",
    });
  }

  const cleaned = sanitizeArtistInput(payload);

  const createdAt = nowISO();
  const artist = {
    id: randomUUID(),
    name: cleaned.name,
    genre: cleaned.genre,
    location: cleaned.location,
    bio: cleaned.bio,
    imageUrl: cleaned.imageUrl,
    socials: cleaned.socials,
    tracks: cleaned.tracks,
    votes: 0,
    status: cleaned.status || "pending",
    createdAt,
    updatedAt: createdAt,
  };

  store.artists.unshift(artist);

  // Match your frontend expectation
  const msg =
    artist.status === "pending"
      ? "Artist submitted successfully (pending approval)."
      : "Artist created successfully.";

  return res.status(201).json({
    success: true,
    message: msg,
    artist,
  });
});

// UPDATE (dev / admin usage): PATCH /api/artists/:id
router.patch("/:id", (req, res) => {
  seedIfEmpty();

  const id = safeText(req.params.id).trim();
  const idx = store.artists.findIndex((a) => safeText(a.id) === id);

  if (idx < 0) {
    return res.status(404).json({
      success: false,
      message: "Artist not found",
    });
  }

  const current = store.artists[idx];
  const patch = req.body || {};

  const next = {
    ...current,
    name: safeText(patch.name ?? current.name).trim(),
    genre: safeText(patch.genre ?? current.genre).trim(),
    location: safeText(patch.location ?? current.location).trim(),
    bio: safeText(patch.bio ?? current.bio).trim(),
    imageUrl: safeText(patch.imageUrl ?? current.imageUrl).trim(),
    socials:
      patch && typeof patch.socials === "object" && patch.socials
        ? patch.socials
        : current.socials,
    tracks: Array.isArray(patch.tracks) ? patch.tracks : current.tracks,
    status: normStatus(patch.status) || current.status,
    votes:
      typeof patch.votes === "number" && Number.isFinite(patch.votes)
        ? patch.votes
        : current.votes,
    updatedAt: nowISO(),
  };

  store.artists[idx] = next;

  return res.json({
    success: true,
    message: "Artist updated",
    artist: next,
  });
});

export default router;