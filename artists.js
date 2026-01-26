// artists.js
// iBand Artists Router — public + admin-safe

import express from "express";
import { randomUUID } from "crypto";

const router = express.Router();

// -----------------------------
// In-memory artist store (MVP)
// -----------------------------
let ARTISTS = [
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
    tracks: [
      {
        title: "Demo Track",
        url: "",
        platform: "mp3",
        durationSec: 30,
      },
    ],
    votes: 42,
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// -----------------------------
// Helpers
// -----------------------------
function safeText(v) {
  return String(v || "").trim();
}

// -----------------------------
// ✅ GET /api/artists
// Public: returns active only
// -----------------------------
router.get("/", (req, res) => {
  const active = ARTISTS.filter((a) => a.status === "active");
  res.json({ success: true, count: active.length, artists: active });
});

// -----------------------------
// ✅ GET /api/artists/:id
// Public: fetch one artist
// -----------------------------
router.get("/:id", (req, res) => {
  const found = ARTISTS.find((a) => a.id === req.params.id);
  if (!found) {
    return res.status(404).json({
      success: false,
      message: "Artist not found",
    });
  }

  res.json({ success: true, artist: found });
});

// -----------------------------
// ✅ POST /api/artists
// Public: submission creates pending artist
// -----------------------------
router.post("/", (req, res) => {
  const body = req.body || {};

  if (!body.name || !body.bio) {
    return res.status(400).json({
      success: false,
      message: "Artist name + bio are required.",
    });
  }

  const artist = {
    id: randomUUID(),
    name: safeText(body.name),
    genre: safeText(body.genre),
    location: safeText(body.location),
    bio: safeText(body.bio),
    imageUrl: safeText(body.imageUrl),
    socials: body.socials || {},
    tracks: Array.isArray(body.tracks) ? body.tracks : [],
    votes: 0,

    // Always pending for admin approval
    status: "pending",

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  ARTISTS.push(artist);

  res.status(201).json({
    success: true,
    message: "Artist submitted successfully (pending approval).",
    artist,
  });
});

// -----------------------------
// ✅ DEV ONLY: POST /api/artists/seed-active
// Creates active artist instantly
// -----------------------------
router.post("/seed-active", (req, res) => {
  const body = req.body || {};

  const artist = {
    id: randomUUID(),
    name: safeText(body.name || "Seed Artist"),
    genre: safeText(body.genre),
    location: safeText(body.location),
    bio: safeText(body.bio || "Active seeded artist."),
    votes: 0,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  ARTISTS.push(artist);

  res.status(201).json({
    success: true,
    message: "Active artist created successfully.",
    artist,
  });
});

export default router;