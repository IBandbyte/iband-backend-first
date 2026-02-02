// artists.js (root) — ESM (default export)
// iBand Backend - Artists Router (HARDENED)
// - Public POST creates PENDING by default (admin can override)
// - Admin can list/approve/reject/update status
// - Public GET /api/artists?status=active returns ACTIVE artists
// - Consistent response shapes: { success, count, artists } and { success, artist }
// - Best-effort persistence to JSON file

import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

const DB_FILE = path.join(process.cwd(), "artists.db.json");

function nowIso() {
  return new Date().toISOString();
}

function safeText(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function normalizeStatus(s) {
  const v = safeText(s).trim().toLowerCase();
  if (v === "active" || v === "pending" || v === "rejected") return v;
  return "";
}

function makeId() {
  try {
    // Node 18+ supports crypto.randomUUID
    // Node 21 definitely supports it
    // eslint-disable-next-line node/no-unsupported-features/node-builtins
    const { randomUUID } = await import("crypto");
    if (randomUUID) return randomUUID();
  } catch {
    // ignore
  }
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

// NOTE: since we used await import above, we need a non-async fallback ID generator too.
// We'll use a simpler generator in normal flow.
function makeIdSync() {
  try {
    // eslint-disable-next-line node/no-unsupported-features/node-builtins
    const crypto = require("crypto");
    if (crypto?.randomUUID) return crypto.randomUUID();
  } catch {
    // ignore
  }
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function bestEffortReadDb() {
  try {
    if (!fs.existsSync(DB_FILE)) return null;
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const parsed = JSON.parse(raw || "{}");
    if (!parsed || !Array.isArray(parsed.artists)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function bestEffortWriteDb(artists) {
  try {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify({ artists, updatedAt: nowIso() }, null, 2),
      "utf8"
    );
    return true;
  } catch {
    return false;
  }
}

function seedArtists() {
  const t = nowIso();
  return [
    {
      id: "demo",
      name: "Demo Artist",
      genre: "Pop / Urban",
      location: "London, UK",
      bio: "Demo artist used for initial platform validation.",
      imageUrl: "",
      socials: {},
      tracks: [],
      votes: 42,
      status: "active",
      createdAt: t,
      updatedAt: t,
    },
  ];
}

let ARTISTS = (() => {
  const db = bestEffortReadDb();
  if (db && Array.isArray(db.artists) && db.artists.length) return db.artists;
  const seeded = seedArtists();
  bestEffortWriteDb(seeded);
  return seeded;
})();

function persist() {
  bestEffortWriteDb(ARTISTS);
}

function isAdmin(req) {
  // If ADMIN_KEY not set, allow admin actions (dev mode)
  const required = safeText(process.env.ADMIN_KEY).trim();
  if (!required) return true;

  const provided = safeText(req.headers["x-admin-key"]).trim();
  return provided && provided === required;
}

function requireAdmin(req, res) {
  if (!isAdmin(req)) {
    res.status(401).json({ success: false, message: "Admin key required." });
    return false;
  }
  return true;
}

function sanitizeArtistInput(body = {}) {
  const name = safeText(body.name).trim();
  const genre = safeText(body.genre).trim();
  const location = safeText(body.location).trim();
  const bio = safeText(body.bio).trim();

  const imageUrl = safeText(body.imageUrl).trim();
  const socials =
    body.socials && typeof body.socials === "object" ? body.socials : {};
  const tracks = Array.isArray(body.tracks) ? body.tracks : [];

  return { name, genre, location, bio, imageUrl, socials, tracks };
}

function matchesQuery(artist, q) {
  const query = safeText(q).trim().toLowerCase();
  if (!query) return true;

  const hay = [
    safeText(artist.name),
    safeText(artist.genre),
    safeText(artist.location),
    safeText(artist.bio),
  ]
    .join(" ")
    .toLowerCase();

  return hay.includes(query);
}

function listArtistsCore({ status, q, page, limit }) {
  const st = normalizeStatus(status);
  let items = ARTISTS.slice();

  if (st) items = items.filter((a) => safeText(a.status).toLowerCase() === st);
  if (q) items = items.filter((a) => matchesQuery(a, q));

  // newest first
  items.sort((a, b) => {
    const ta = Date.parse(a.createdAt || 0) || 0;
    const tb = Date.parse(b.createdAt || 0) || 0;
    return tb - ta;
  });

  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 50));
  const start = (p - 1) * l;
  const paged = items.slice(start, start + l);

  return { total: items.length, items: paged, page: p, limit: l };
}

/* ---------------------------------------
   PUBLIC ROUTES
--------------------------------------- */

// GET /api/artists?status=active&q=bad&page=1&limit=50
router.get("/artists", (req, res) => {
  const { status, q, page, limit } = req.query;
  const result = listArtistsCore({ status, q, page, limit });

  res.json({
    success: true,
    count: result.total,
    artists: result.items,
    page: result.page,
    limit: result.limit,
  });
});

// GET /api/artists/:id
router.get("/artists/:id", (req, res) => {
  const id = safeText(req.params.id).trim();
  const artist = ARTISTS.find((a) => safeText(a.id) === id);

  if (!artist) {
    return res.status(404).json({ success: false, message: "Artist not found." });
  }

  res.json({ success: true, artist });
});

// POST /api/artists (Public creates pending; admin can override)
router.post("/artists", (req, res) => {
  const input = sanitizeArtistInput(req.body || {});
  if (!input.name) {
    return res.status(400).json({ success: false, message: "Name is required." });
  }

  const t = nowIso();
  const admin = isAdmin(req);
  const requested = normalizeStatus(req.body?.status);
  const status = admin && requested ? requested : "pending";

  const artist = {
    id: makeIdSync(),
    name: input.name,
    genre: input.genre,
    location: input.location,
    bio: input.bio,
    imageUrl: input.imageUrl,
    socials: input.socials,
    tracks: input.tracks,
    votes: 0,
    status,
    createdAt: t,
    updatedAt: t,
  };

  ARTISTS.push(artist);
  persist();

  const msg =
    status === "pending"
      ? "Artist submitted successfully (pending approval)."
      : "Artist created successfully.";

  return res.status(201).json({ success: true, message: msg, artist });
});

/* ---------------------------------------
   ADMIN ROUTES
--------------------------------------- */

// GET /api/admin/artists?status=pending&q=...
router.get("/admin/artists", (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { status, q, page, limit } = req.query;
  const result = listArtistsCore({ status, q, page, limit });

  res.json({
    success: true,
    count: result.total,
    artists: result.items,
    page: result.page,
    limit: result.limit,
  });
});

// PATCH /api/admin/artists/:id  { status, moderationNote? }
router.patch("/admin/artists/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;

  const id = safeText(req.params.id).trim();
  const artist = ARTISTS.find((a) => safeText(a.id) === id);

  if (!artist) {
    return res.status(404).json({ success: false, message: "Artist not found." });
  }

  const next = normalizeStatus(req.body?.status);
  if (!next) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status. Use "active", "pending", or "rejected".',
    });
  }

  artist.status = next;
  artist.updatedAt = nowIso();

  if (req.body?.moderationNote !== undefined) {
    artist.moderationNote = safeText(req.body.moderationNote).trim();
  }

  persist();
  res.json({ success: true, message: "Artist updated.", artist });
});

// POST /api/admin/artists/:id/approve
router.post("/admin/artists/:id/approve", (req, res) => {
  if (!requireAdmin(req, res)) return;

  const id = safeText(req.params.id).trim();
  const artist = ARTISTS.find((a) => safeText(a.id) === id);

  if (!artist) {
    return res.status(404).json({ success: false, message: "Artist not found." });
  }

  artist.status = "active";
  artist.updatedAt = nowIso();

  if (req.body?.moderationNote !== undefined) {
    artist.moderationNote = safeText(req.body.moderationNote).trim();
  }

  persist();
  res.json({ success: true, message: "Artist approved.", artist });
});

// POST /api/admin/artists/:id/reject
router.post("/admin/artists/:id/reject", (req, res) => {
  if (!requireAdmin(req, res)) return;

  const id = safeText(req.params.id).trim();
  const artist = ARTISTS.find((a) => safeText(a.id) === id);

  if (!artist) {
    return res.status(404).json({ success: false, message: "Artist not found." });
  }

  artist.status = "rejected";
  artist.updatedAt = nowIso();

  if (req.body?.moderationNote !== undefined) {
    artist.moderationNote = safeText(req.body.moderationNote).trim();
  }

  persist();
  res.json({ success: true, message: "Artist rejected.", artist });
});

// POST /api/admin/seed (ensure demo exists)
router.post("/admin/seed", (req, res) => {
  if (!requireAdmin(req, res)) return;

  const hasDemo = ARTISTS.some((a) => safeText(a.id) === "demo");
  if (!hasDemo) {
    ARTISTS = ARTISTS.concat(seedArtists());
    persist();
  }

  res.json({ success: true, message: "Seed ensured.", count: ARTISTS.length });
});

export default router;