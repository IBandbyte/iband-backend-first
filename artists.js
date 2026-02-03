// artists.js
// iBand Backend — Artists Router (LOCKED)
// - Default export for ESM
// - No await import('crypto')
// - Public list correctly returns active/pending/rejected
// - Submit always pending

import express from "express";
import { randomUUID } from "node:crypto";

const router = express.Router();

/**
 * In-memory store shared across routers.
 * Note: Render free tier resets memory on redeploy/sleep.
 */
const store = globalThis.__IBAND_STORE__ || { artists: [] };
globalThis.__IBAND_STORE__ = store;

function safeText(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function normalizeStatus(v, fallback = "active") {
  const s = safeText(v).trim().toLowerCase();
  if (!s) return fallback;
  if (s === "approved") return "active";
  if (s === "rejected" || s === "reject") return "rejected";
  if (["active", "pending", "rejected"].includes(s)) return s;
  return fallback;
}

function normalizeArtist(raw = {}) {
  const socials = raw.socials && typeof raw.socials === "object" ? raw.socials : {};
  const tracks = Array.isArray(raw.tracks) ? raw.tracks : [];

  const now = new Date().toISOString();

  return {
    id: safeText(raw.id || "").trim(),
    name: safeText(raw.name || "").trim(),
    genre: safeText(raw.genre || "").trim(),
    location: safeText(raw.location || "").trim(),
    bio: safeText(raw.bio || "").trim(),
    imageUrl: safeText(raw.imageUrl || "").trim(),
    socials: {
      instagram: safeText(socials.instagram || "").trim(),
      tiktok: safeText(socials.tiktok || "").trim(),
      youtube: safeText(socials.youtube || "").trim(),
      spotify: safeText(socials.spotify || "").trim(),
      soundcloud: safeText(socials.soundcloud || "").trim(),
      website: safeText(socials.website || "").trim(),
    },
    tracks: tracks
      .map((t) => ({
        title: safeText(t?.title || "").trim(),
        url: safeText(t?.url || "").trim(),
        platform: safeText(t?.platform || "").trim(),
      }))
      .filter((t) => t.title || t.url),
    votes: Number.isFinite(Number(raw.votes)) ? Number(raw.votes) : 0,
    status: normalizeStatus(raw.status, "active"),
    createdAt: safeText(raw.createdAt || now),
    updatedAt: safeText(raw.updatedAt || now),
  };
}

function matchesQuery(a, q) {
  const needle = safeText(q).trim().toLowerCase();
  if (!needle) return true;

  const hay = [
    a.id,
    a.name,
    a.genre,
    a.location,
    a.bio,
    a.status,
  ]
    .map((x) => safeText(x).toLowerCase())
    .join(" ");

  return hay.includes(needle);
}

/**
 * GET /api/artists
 * Query:
 * - status=active|pending|rejected (default active)
 * - q=search text
 * - page, limit
 */
router.get("/", (req, res) => {
  const status = normalizeStatus(req.query.status, "active");
  const q = safeText(req.query.q || "");
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));

  const filtered = store.artists
    .map((x) => normalizeArtist(x))
    .filter((a) => normalizeStatus(a.status, "active") === status)
    .filter((a) => matchesQuery(a, q));

  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);

  return res.json({
    success: true,
    count: items.length,
    artists: items,
    page,
    limit,
    total: filtered.length,
    status,
    q,
  });
});

/**
 * GET /api/artists/:id
 */
router.get("/:id", (req, res) => {
  const id = safeText(req.params.id).trim();
  const found = store.artists.find((a) => safeText(a.id).trim() === id);

  if (!found) {
    return res.status(404).json({
      success: false,
      message: "Artist not found",
    });
  }

  return res.json({
    success: true,
    artist: normalizeArtist(found),
  });
});

/**
 * POST /api/artists
 * Public submit: always pending
 */
router.post("/", (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  const now = new Date().toISOString();

  const artist = normalizeArtist({
    ...body,
    id: randomUUID(),
    status: "pending",
    votes: 0,
    createdAt: now,
    updatedAt: now,
  });

  if (artist.name.length < 2 || artist.bio.length < 10) {
    return res.status(400).json({
      success: false,
      message: "Validation failed: name (>=2) and bio (>=10) are required.",
    });
  }

  store.artists.unshift(artist);

  return res.status(201).json({
    success: true,
    message: "Artist submitted successfully (pending approval).",
    artist,
  });
});

export default router;