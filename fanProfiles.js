// fanProfiles.js (ESM) — Phase H5.3 Fan Identity System
// Stores:
// - fan-profiles.json (profile registry)
// Purpose:
// - fan identity / preferences
// - preferred genres and favourite artists
// - ambassador badge display context
// - permissions like canCreateGenreRoom

import express from "express";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";
import { fileURLToPath, pathToFileURL } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICE = "fan-profiles";
const PHASE = "H5.3";
const VERSION = 1;

const DB_ROOT = process.env.IBAND_DATA_DIR || "/var/data/iband/db";
const STORAGE_DIR = path.join(DB_ROOT, "fans");
const STORE_FILE = path.join(STORAGE_DIR, "fan-profiles.json");

const LIMITS = {
  maxBodyBytes: 25000,
  maxGenres: 12,
  maxArtists: 20,
  maxBioLen: 240,
  maxDisplayNameLen: 60,
  maxLocationLen: 80,
  maxAvatarUrlLen: 400,
};

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  return crypto.randomBytes(12).toString("hex");
}

function safeStr(v, max = 300) {
  const s = (v ?? "").toString().trim();
  return s.length > max ? s.slice(0, max) : s;
}

function uniqCaseInsensitive(values) {
  const out = [];
  const seen = new Set();
  for (const raw of values || []) {
    const v = safeStr(raw, 80);
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

async function ensureStore() {
  await fsp.mkdir(STORAGE_DIR, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) {
    await fsp.writeFile(
      STORE_FILE,
      JSON.stringify({ version: 1, updatedAt: nowIso(), profiles: [] }, null, 2)
    );
  }
}

async function readStore() {
  await ensureStore();
  const raw = await fsp.readFile(STORE_FILE, "utf8");
  const parsed = JSON.parse(raw || "{}");
  if (!Array.isArray(parsed.profiles)) {
    return { version: 1, updatedAt: nowIso(), profiles: [] };
  }
  return parsed;
}

async function writeStore(store) {
  store.updatedAt = nowIso();
  await fsp.writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

async function loadAmbassadorSummary(artistId, fanId) {
  if (!artistId || !fanId) return null;

  try {
    const abs = path.resolve(__dirname, "./ambassadors.js");
    if (!fs.existsSync(abs)) return null;

    const mod = await import(pathToFileURL(abs).href);
    const routerOrMod = mod?.default || mod;

    // No direct export contract exists, so we don't call internals.
    // Instead return contextual placeholder; frontend can call ambassador endpoint directly.
    return {
      artistId,
      fanId,
      linked: true,
      note: "Use /api/ambassadors/artist/:artistId/fan/:fanId for live badge details.",
    };
  } catch {
    return null;
  }
}

function derivePermissions(profile) {
  const tier = safeStr(profile?.ambassadorTier, 20).toLowerCase();

  return {
    canCreateGenreRoom: tier === "gold" || tier === "silver" || Boolean(profile?.verifiedCreatorFan),
    canSuggestGenreRoom: true,
    canCreateCommunityRoom: true,
    canJoinAmbassadorRooms: tier === "gold" || tier === "silver" || tier === "bronze",
    canHostRoom: tier === "gold" || tier === "silver",
  };
}

function normalizeProfileInput(body, existing = null) {
  const preferredGenres = uniqCaseInsensitive(body.preferredGenres || existing?.preferredGenres || [])
    .slice(0, LIMITS.maxGenres);

  const favouriteArtists = uniqCaseInsensitive(body.favouriteArtists || existing?.favouriteArtists || [])
    .slice(0, LIMITS.maxArtists);

  const badges = uniqCaseInsensitive(body.badges || existing?.badges || []).slice(0, 20);

  return {
    id: existing?.id || safeStr(body.id, 64) || `fan_${makeId()}`,
    fanId: safeStr(body.fanId, 80) || existing?.fanId || null,
    displayName: safeStr(body.displayName, LIMITS.maxDisplayNameLen) || existing?.displayName || null,
    username: safeStr(body.username, 60) || existing?.username || null,
    bio: safeStr(body.bio, LIMITS.maxBioLen) || existing?.bio || null,
    location: safeStr(body.location, LIMITS.maxLocationLen) || existing?.location || null,
    avatarUrl: safeStr(body.avatarUrl, LIMITS.maxAvatarUrlLen) || existing?.avatarUrl || null,

    preferredGenres,
    favouriteArtists,

    ambassadorArtistId: safeStr(body.ambassadorArtistId, 80) || existing?.ambassadorArtistId || null,
    ambassadorTier: safeStr(body.ambassadorTier, 20) || existing?.ambassadorTier || "none",
    badges,

    verifiedCreatorFan: Boolean(body.verifiedCreatorFan ?? existing?.verifiedCreatorFan ?? false),

    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

function ok(res, payload) {
  res.status(200).json(payload);
}

function bad(res, status, error, extra = {}) {
  res.status(status).json({ success: false, error, ...extra });
}

// Health
router.get("/health", async (req, res) => {
  await ensureStore();
  const stat = fs.statSync(STORE_FILE);

  const store = await readStore();

  ok(res, {
    success: true,
    service: SERVICE,
    phase: PHASE,
    version: VERSION,
    storageDir: STORAGE_DIR,
    file: {
      path: STORE_FILE,
      ok: true,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
    },
    store: {
      profiles: store.profiles.length,
      updatedAt: store.updatedAt,
    },
    limits: LIMITS,
    ts: nowIso(),
  });
});

// Create or upsert by fanId
router.post("/upsert", async (req, res) => {
  const body = req.body || {};
  const bytes = Buffer.byteLength(JSON.stringify(body), "utf8");
  if (bytes > LIMITS.maxBodyBytes) return bad(res, 413, "payload_too_large");

  const fanId = safeStr(body.fanId, 80);
  if (!fanId) return bad(res, 400, "missing_fanId");

  const store = await readStore();
  const existingIndex = store.profiles.findIndex((p) => p.fanId === fanId);
  const existing = existingIndex >= 0 ? store.profiles[existingIndex] : null;

  const profile = normalizeProfileInput(body, existing);
  profile.fanId = fanId;

  if (existingIndex >= 0) {
    store.profiles[existingIndex] = profile;
  } else {
    store.profiles.unshift(profile);
  }

  await writeStore(store);

  ok(res, {
    success: true,
    message: existing ? "Profile updated." : "Profile created.",
    profile,
    permissions: derivePermissions(profile),
  });
});

// List profiles
router.get("/list", async (req, res) => {
  const store = await readStore();
  const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));

  ok(res, {
    success: true,
    profiles: store.profiles.slice(0, limit).map((p) => ({
      fanId: p.fanId,
      displayName: p.displayName,
      username: p.username,
      preferredGenres: p.preferredGenres,
      favouriteArtists: p.favouriteArtists,
      ambassadorArtistId: p.ambassadorArtistId,
      ambassadorTier: p.ambassadorTier,
      badges: p.badges,
      updatedAt: p.updatedAt,
    })),
    meta: {
      total: store.profiles.length,
      limit,
      ts: nowIso(),
    },
  });
});

// Get fan profile by fanId
router.get("/:fanId", async (req, res) => {
  const fanId = safeStr(req.params.fanId, 80);
  const artistId = safeStr(req.query.artistId, 80);

  const store = await readStore();
  const profile = store.profiles.find((p) => p.fanId === fanId);
  if (!profile) return bad(res, 404, "fan_profile_not_found", { fanId });

  const ambassadorContext = await loadAmbassadorSummary(artistId || profile.ambassadorArtistId, fanId);

  ok(res, {
    success: true,
    profile,
    permissions: derivePermissions(profile),
    ambassadorContext,
    ts: nowIso(),
  });
});

// Lightweight permissions endpoint for frontend checks
router.get("/:fanId/permissions", async (req, res) => {
  const fanId = safeStr(req.params.fanId, 80);

  const store = await readStore();
  const profile = store.profiles.find((p) => p.fanId === fanId);
  if (!profile) return bad(res, 404, "fan_profile_not_found", { fanId });

  ok(res, {
    success: true,
    fanId,
    permissions: derivePermissions(profile),
    ts: nowIso(),
  });
});

export default router;