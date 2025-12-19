// artists.js (CommonJS)
// Future-proof artist "model" + routes with file-backed storage (no DB required yet)

const express = require("express");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const router = express.Router();

// ---------- Storage (file-backed) ----------
const DATA_DIR = path.join(process.cwd(), "data");
const ARTISTS_FILE = path.join(DATA_DIR, "artists.json");

// Seed used on first boot (or if file missing/corrupt)
const SEED_ARTISTS = [
  {
    id: "demo",
    name: "Demo Artist",
    stageName: "Demo Artist",
    bio: "This is a demo placeholder. Next phase will display a real artist with track previews and comments.",
    genre: "Pop / Urban",
    location: "London, UK",
    country: "UK",
    language: "English",
    imageUrl: "",
    bannerUrl: "",
    socials: {
      instagram: "https://instagram.com/",
      youtube: "https://youtube.com/",
      tiktok: "",
      spotify: "",
      soundcloud: "",
      website: "",
    },
    tracks: [
      {
        id: "trk_demo_1",
        title: "Demo Track",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        platform: "mp3",
        durationSec: 30,
      },
    ],
    stats: {
      votes: 42,
      followers: 0,
      plays: 0,
    },
    status: "active", // active | pending | banned | archived
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

async function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(ARTISTS_FILE)) {
    await fsp.writeFile(ARTISTS_FILE, JSON.stringify({ artists: SEED_ARTISTS }, null, 2), "utf-8");
    return;
  }

  // Validate shape; if corrupt, reseed (never crash prod)
  try {
    const raw = await fsp.readFile(ARTISTS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.artists)) {
      await fsp.writeFile(ARTISTS_FILE, JSON.stringify({ artists: SEED_ARTISTS }, null, 2), "utf-8");
    }
  } catch {
    await fsp.writeFile(ARTISTS_FILE, JSON.stringify({ artists: SEED_ARTISTS }, null, 2), "utf-8");
  }
}

async function readStore() {
  await ensureStore();
  const raw = await fsp.readFile(ARTISTS_FILE, "utf-8");
  const parsed = JSON.parse(raw);
  return { artists: Array.isArray(parsed.artists) ? parsed.artists : [] };
}

async function writeStore(store) {
  await ensureStore();
  await fsp.writeFile(ARTISTS_FILE, JSON.stringify(store, null, 2), "utf-8");
}

// ---------- Helpers ----------
function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix = "art") {
  // short, URL-safe-ish id
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

function normalizeStr(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function clampInt(v, def, min, max) {
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) return def;
  return Math.min(Math.max(n, min), max);
}

function isValidUrl(u) {
  const s = normalizeStr(u);
  if (!s) return true;
  try {
    new URL(s);
    return true;
  } catch {
    return false;
  }
}

function safeSocials(input = {}) {
  const socials = input && typeof input === "object" ? input : {};
  const out = {
    instagram: normalizeStr(socials.instagram),
    youtube: normalizeStr(socials.youtube),
    tiktok: normalizeStr(socials.tiktok),
    spotify: normalizeStr(socials.spotify),
    soundcloud: normalizeStr(socials.soundcloud),
    website: normalizeStr(socials.website),
  };

  // validate urls if present
  for (const k of Object.keys(out)) {
    if (!isValidUrl(out[k])) out[k] = "";
  }
  return out;
}

function safeTracks(input) {
  const arr = Array.isArray(input) ? input : [];
  return arr
    .map((t) => {
      const obj = t && typeof t === "object" ? t : {};
      const url = normalizeStr(obj.url);
      const platform = normalizeStr(obj.platform || "link").toLowerCase();
      return {
        id: normalizeStr(obj.id) || makeId("trk"),
        title: normalizeStr(obj.title || "Untitled Track"),
        url: isValidUrl(url) ? url : "",
        platform: platform || "link",
        durationSec: clampInt(obj.durationSec, 0, 0, 60 * 60),
      };
    })
    .filter((t) => t.title.length > 0);
}

function safeStatus(s) {
  const v = normalizeStr(s).toLowerCase();
  const allowed = new Set(["active", "pending", "banned", "archived"]);
  return allowed.has(v) ? v : "active";
}

function toPublicArtist(a) {
  // keep everything for now, but this is where we can hide admin-only fields later
  return a;
}

function matchesQuery(artist, q) {
  const needle = normalizeStr(q).toLowerCase();
  if (!needle) return true;

  const hay = [
    artist.name,
    artist.stageName,
    artist.bio,
    artist.genre,
    artist.location,
    artist.country,
    artist.language,
  ]
    .map((x) => normalizeStr(x).toLowerCase())
    .join(" | ");

  return hay.includes(needle);
}

// ---------- Response helpers ----------
function ok(res, data, meta) {
  const payload = { success: true, data };
  if (meta) payload.meta = meta;
  return res.status(200).json(payload);
}

function created(res, data) {
  return res.status(201).json({ success: true, data });
}

function bad(res, message, details) {
  const payload = { success: false, message: message || "Bad request" };
  if (details) payload.details = details;
  return res.status(400).json(payload);
}

function notFound(res) {
  return res.status(404).json({ success: false, message: "Route not found." });
}

// ---------- Routes ----------

/**
 * GET /artists
 * Query:
 *  - q: free text search
 *  - genre, location, status
 *  - sort: new | votes | name
 *  - order: asc | desc
 *  - page, limit
 */
router.get("/", async (req, res) => {
  try {
    const { artists } = await readStore();

    const q = req.query.q;
    const genre = normalizeStr(req.query.genre).toLowerCase();
    const location = normalizeStr(req.query.location).toLowerCase();
    const status = normalizeStr(req.query.status).toLowerCase();

    const sort = normalizeStr(req.query.sort || "new").toLowerCase();
    const order = normalizeStr(req.query.order || "desc").toLowerCase();

    const page = clampInt(req.query.page, 1, 1, 10_000);
    const limit = clampInt(req.query.limit, 20, 1, 100);
    const offset = (page - 1) * limit;

    let filtered = artists.filter((a) => {
      if (!matchesQuery(a, q)) return false;
      if (genre && normalizeStr(a.genre).toLowerCase().includes(genre) === false) return false;
      if (location && normalizeStr(a.location).toLowerCase().includes(location) === false) return false;
      if (status && normalizeStr(a.status).toLowerCase() !== status) return false;
      return true;
    });

    const dir = order === "asc" ? 1 : -1;

    filtered.sort((a, b) => {
      if (sort === "votes") {
        const av = Number(a?.stats?.votes || 0);
        const bv = Number(b?.stats?.votes || 0);
        return (av - bv) * dir;
      }
      if (sort === "name") {
        const an = normalizeStr(a.stageName || a.name).toLowerCase();
        const bn = normalizeStr(b.stageName || b.name).toLowerCase();
        if (an < bn) return -1 * dir;
        if (an > bn) return 1 * dir;
        return 0;
      }
      // default: "new" (createdAt)
      const at = new Date(a.createdAt || 0).getTime();
      const bt = new Date(b.createdAt || 0).getTime();
      return (at - bt) * dir;
    });

    const total = filtered.length;
    const paged = filtered.slice(offset, offset + limit).map(toPublicArtist);

    return ok(res, paged, {
      page,
      limit,
      total,
      hasMore: offset + limit < total,
      sort,
      order,
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error", error: String(e?.message || e) });
  }
});

/**
 * GET /artists/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const id = normalizeStr(req.params.id);
    if (!id) return bad(res, "Missing artist id");

    const { artists } = await readStore();
    const artist = artists.find((a) => a.id === id);
    if (!artist) return notFound(res);

    return ok(res, toPublicArtist(artist));
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error", error: String(e?.message || e) });
  }
});

/**
 * POST /artists
 * Body: minimal required: name OR stageName
 */
router.post("/", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};

    const name = normalizeStr(body.name);
    const stageName = normalizeStr(body.stageName) || name;

    if (!name && !stageName) {
      return bad(res, "name or stageName is required");
    }

    const { artists } = await readStore();
    const id = normalizeStr(body.id) || makeId("art");

    if (artists.some((a) => a.id === id)) {
      return bad(res, "Artist id already exists");
    }

    const artist = {
      id,
      name: name || stageName,
      stageName: stageName || name,
      bio: normalizeStr(body.bio),
      genre: normalizeStr(body.genre),
      location: normalizeStr(body.location),
      country: normalizeStr(body.country),
      language: normalizeStr(body.language),
      imageUrl: isValidUrl(body.imageUrl) ? normalizeStr(body.imageUrl) : "",
      bannerUrl: isValidUrl(body.bannerUrl) ? normalizeStr(body.bannerUrl) : "",
      socials: safeSocials(body.socials),
      tracks: safeTracks(body.tracks),
      stats: {
        votes: clampInt(body?.stats?.votes, 0, 0, 1_000_000_000),
        followers: clampInt(body?.stats?.followers, 0, 0, 1_000_000_000),
        plays: clampInt(body?.stats?.plays, 0, 0, 1_000_000_000),
      },
      status: safeStatus(body.status),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    artists.push(artist);
    await writeStore({ artists });

    return created(res, toPublicArtist(artist));
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error", error: String(e?.message || e) });
  }
});

/**
 * PUT /artists/:id (full replace-ish)
 * PATCH /artists/:id (partial update)
 */
async function updateArtist(req, res, isPatch) {
  try {
    const id = normalizeStr(req.params.id);
    if (!id) return bad(res, "Missing artist id");

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const store = await readStore();
    const idx = store.artists.findIndex((a) => a.id === id);
    if (idx === -1) return notFound(res);

    const current = store.artists[idx];

    const next = { ...current };

    // Only overwrite on PUT; on PATCH only apply provided keys
    const apply = (key, value) => {
      if (!isPatch) {
        next[key] = value;
        return;
      }
      if (body[key] !== undefined) next[key] = value;
    };

    apply("name", normalizeStr(body.name) || next.name);
    apply("stageName", normalizeStr(body.stageName) || next.stageName);
    apply("bio", normalizeStr(body.bio));
    apply("genre", normalizeStr(body.genre));
    apply("location", normalizeStr(body.location));
    apply("country", normalizeStr(body.country));
    apply("language", normalizeStr(body.language));

    if (!isPatch || body.imageUrl !== undefined) {
      next.imageUrl = isValidUrl(body.imageUrl) ? normalizeStr(body.imageUrl) : next.imageUrl;
    }
    if (!isPatch || body.bannerUrl !== undefined) {
      next.bannerUrl = isValidUrl(body.bannerUrl) ? normalizeStr(body.bannerUrl) : next.bannerUrl;
    }

    if (!isPatch || body.socials !== undefined) next.socials = safeSocials(body.socials);
    if (!isPatch || body.tracks !== undefined) next.tracks = safeTracks(body.tracks);

    if (!isPatch || body.stats !== undefined) {
      const stats = body.stats && typeof body.stats === "object" ? body.stats : {};
      next.stats = {
        votes: clampInt(stats.votes ?? next?.stats?.votes, next?.stats?.votes || 0, 0, 1_000_000_000),
        followers: clampInt(stats.followers ?? next?.stats?.followers, next?.stats?.followers || 0, 0, 1_000_000_000),
        plays: clampInt(stats.plays ?? next?.stats?.plays, next?.stats?.plays || 0, 0, 1_000_000_000),
      };
    }

    if (!isPatch || body.status !== undefined) next.status = safeStatus(body.status);

    next.updatedAt = nowIso();

    store.artists[idx] = next;
    await writeStore(store);

    return ok(res, toPublicArtist(next));
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error", error: String(e?.message || e) });
  }
}

router.put("/:id", (req, res) => updateArtist(req, res, false));
router.patch("/:id", (req, res) => updateArtist(req, res, true));

/**
 * DELETE /artists/:id
 * Soft delete -> status=archived
 */
router.delete("/:id", async (req, res) => {
  try {
    const id = normalizeStr(req.params.id);
    if (!id) return bad(res, "Missing artist id");

    const store = await readStore();
    const idx = store.artists.findIndex((a) => a.id === id);
    if (idx === -1) return notFound(res);

    store.artists[idx].status = "archived";
    store.artists[idx].updatedAt = nowIso();

    await writeStore(store);
    return ok(res, { id, status: "archived" });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error", error: String(e?.message || e) });
  }
});

/**
 * POST /artists/:id/votes
 * Body: { amount?: number }  (default 1)
 */
router.post("/:id/votes", async (req, res) => {
  try {
    const id = normalizeStr(req.params.id);
    if (!id) return bad(res, "Missing artist id");

    const amount = clampInt(req.body?.amount, 1, 1, 1000);

    const store = await readStore();
    const idx = store.artists.findIndex((a) => a.id === id);
    if (idx === -1) return notFound(res);

    const cur = store.artists[idx];
    const currentVotes = Number(cur?.stats?.votes || 0);
    cur.stats = cur.stats || { votes: 0, followers: 0, plays: 0 };
    cur.stats.votes = currentVotes + amount;
    cur.updatedAt = nowIso();

    store.artists[idx] = cur;
    await writeStore(store);

    return ok(res, { id, votes: cur.stats.votes });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error", error: String(e?.message || e) });
  }
});

module.exports = router;