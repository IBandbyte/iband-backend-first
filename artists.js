// artists.js (ESM)
// Public Artists Router
// - Canonical list:   GET  /api/artists?status=active&q=&page=&limit=
// - Canonical detail: GET  /api/artists/:id  -> { success:true, artist }
// - Submit artist:    POST /api/artists      -> pending by default
//
// IMPORTANT:
// - MUST default export router (Render ESM import expects default)
// - MUST NOT use top-level await

import express from "express";
import { randomUUID } from "crypto";
import artistsStore from "./artistsStore.js";

const router = express.Router();

/* -----------------------------
   Helpers
----------------------------- */

function safeText(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function toNumber(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeStatus(s) {
  const v = safeText(s).toLowerCase();
  if (!v) return "";
  if (["active", "pending", "rejected"].includes(v)) return v;
  if (v === "all" || v === "*") return "all";
  return "";
}

function matchesQ(artist, q) {
  const needle = safeText(q).toLowerCase();
  if (!needle) return true;

  const hay = [
    artist?.name,
    artist?.genre,
    artist?.location,
    artist?.bio,
    artist?.id,
  ]
    .map((x) => safeText(x).toLowerCase())
    .join(" ");

  return hay.includes(needle);
}

function publicSanitizeArtist(a) {
  // Keep permissive for now; later we can hide certain fields if desired.
  return a;
}

function storeList() {
  if (typeof artistsStore.getAll === "function") return artistsStore.getAll();
  if (typeof artistsStore.listArtists === "function") return artistsStore.listArtists();
  return [];
}

function storeGetById(id) {
  if (typeof artistsStore.getById === "function") return artistsStore.getById(id);
  if (typeof artistsStore.getArtist === "function") return artistsStore.getArtist(id);
  return null;
}

function storeCreate(payload) {
  if (typeof artistsStore.create === "function") return artistsStore.create(payload);
  if (typeof artistsStore.createArtist === "function") return artistsStore.createArtist(payload);
  return null;
}

/* -----------------------------
   Routes
----------------------------- */

// GET /api/artists
router.get("/", (req, res) => {
  const status = normalizeStatus(req.query?.status) || "active"; // public default
  const q = safeText(req.query?.q);
  const page = Math.max(1, toNumber(req.query?.page, 1));
  const limit = Math.min(100, Math.max(1, toNumber(req.query?.limit, 50)));

  const all = storeList();
  let filtered = Array.isArray(all) ? all : [];

  // status filter
  if (status !== "all") {
    filtered = filtered.filter((a) => safeText(a?.status).toLowerCase() === status);
  }

  // search filter
  filtered = filtered.filter((a) => matchesQ(a, q));

  const total = filtered.length;

  // pagination
  const start = (page - 1) * limit;
  const paged = filtered.slice(start, start + limit).map(publicSanitizeArtist);

  return res.json({
    success: true,
    count: paged.length,
    artists: paged,
    page,
    limit,
    total,
    status,
    q,
  });
});

// GET /api/artists/:id  (CANONICAL DETAIL)
router.get("/:id", (req, res) => {
  const id = safeText(req.params?.id);
  const artist = storeGetById(id);

  if (!artist) {
    return res.status(404).json({
      success: false,
      message: "Artist not found",
      id,
    });
  }

  return res.json({
    success: true,
    artist: publicSanitizeArtist(artist),
  });
});

// POST /api/artists (SUBMIT)
router.post("/", (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  const payload = {
    id: safeText(body.id) || randomUUID(),
    name: safeText(body.name),
    genre: safeText(body.genre),
    location: safeText(body.location),
    bio: safeText(body.bio),
    imageUrl: safeText(body.imageUrl),
    socials: body.socials && typeof body.socials === "object" ? body.socials : {},
    tracks: Array.isArray(body.tracks) ? body.tracks : [],
    votes: 0,
    status: "pending", // ALWAYS pending for public submit
  };

  if (!payload.name) {
    return res.status(400).json({
      success: false,
      message: "Name is required",
    });
  }

  const created = storeCreate(payload);

  return res.status(201).json({
    success: true,
    message: "Artist submitted successfully (pending approval).",
    artist: created,
  });
});

export default router;