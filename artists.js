/**
 * iBandbyte Backend — Artists Module (Future-proof foundation)
 * Root-based layout: artists.js lives beside server.js
 *
 * Supports:
 * - Music artists, actors/actresses, influencers
 * - Portfolios / auditions / performances (media array)
 * - Voting + basic search/filtering
 *
 * NOTE:
 * This module uses an in-memory store for now (safe + fast for Phase 2).
 * Later we can swap the store for a real DB with minimal frontend changes.
 */

const express = require("express");
const crypto = require("crypto");

const router = express.Router();

/** -----------------------------
 * Helpers
 * ----------------------------- */

function nowISO() {
  return new Date().toISOString();
}

function safeUUID() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // fallback
  return "id_" + crypto.randomBytes(12).toString("hex");
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function clampInt(n, min, max, fallback) {
  const x = Number.parseInt(String(n), 10);
  if (Number.isNaN(x)) return fallback;
  return Math.min(max, Math.max(min, x));
}

function normalizeType(t) {
  const val = String(t || "").trim().toLowerCase();
  if (val === "music" || val === "artist") return "music";
  if (val === "actor" || val === "actress" || val === "acting") return "actor";
  if (val === "influencer" || val === "creator") return "influencer";
  return null;
}

function normalizeVisibility(v) {
  const val = String(v || "").trim().toLowerCase();
  if (val === "public" || val === "listed") return "public";
  if (val === "unlisted") return "unlisted";
  if (val === "private" || val === "hidden") return "private";
  return null;
}

function asArrayOfStrings(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  // comma separated
  if (typeof v === "string") {
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * media item shape (future-proof)
 * type: "track" | "video" | "audition" | "portfolio" | "image" | "link"
 */
function normalizeMedia(media) {
  const arr = Array.isArray(media) ? media : [];
  return arr
    .map((m) => (m && typeof m === "object" ? m : null))
    .filter(Boolean)
    .map((m) => ({
      id: isNonEmptyString(m.id) ? m.id : safeUUID(),
      type: isNonEmptyString(m.type) ? String(m.type).trim().toLowerCase() : "link",
      title: isNonEmptyString(m.title) ? String(m.title).trim() : "",
      url: isNonEmptyString(m.url) ? String(m.url).trim() : "",
      provider: isNonEmptyString(m.provider) ? String(m.provider).trim() : "",
      // optional metadata
      durationSec: Number.isFinite(Number(m.durationSec)) ? Number(m.durationSec) : null,
      thumbnailUrl: isNonEmptyString(m.thumbnailUrl) ? String(m.thumbnailUrl).trim() : "",
      createdAt: isNonEmptyString(m.createdAt) ? String(m.createdAt) : nowISO(),
    }));
}

/**
 * Core Artist Model
 * - type: "music" | "actor" | "influencer"
 * - genres: for music
 * - roles: for acting (e.g., "Lead", "Supporting", "Commercial")
 * - niches: for influencers (e.g., "Fashion", "Fitness")
 */
function validateAndBuildArtist(payload, { partial = false } = {}) {
  const p = payload && typeof payload === "object" ? payload : {};

  // Required on create
  const name = isNonEmptyString(p.name) ? p.name.trim() : null;
  const type = normalizeType(p.type);
  const visibility = normalizeVisibility(p.visibility);

  if (!partial) {
    if (!name) return { ok: false, error: "Name is required." };
    if (!type) return { ok: false, error: "Type is required: music | actor | influencer." };
  }

  // Optional fields
  const bio = isNonEmptyString(p.bio) ? p.bio.trim() : "";
  const location = isNonEmptyString(p.location) ? p.location.trim() : "";
  const avatarUrl = isNonEmptyString(p.avatarUrl) ?