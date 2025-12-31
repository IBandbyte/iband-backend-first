// adminArtists.js (root) — ESM
// Phase 2.2.x Admin moderation routes for artists
// Reads/writes the SAME data file as artists.js: ./data/artists.json
// Exposes:
//   GET    /admin/artists?status=&q=&page=&limit=
//   GET    /admin/artists/:id
//   PATCH  /admin/artists/:id
//   POST   /admin/artists/:id/approve
//   POST   /admin/artists/:id/reject
//   POST   /admin/artists/:id/restore
//   DELETE /admin/artists/:id
//   GET    /admin/stats
//
// Also mirrors under /api/admin/*
//
// Optional auth:
//   If process.env.ADMIN_KEY is set, require header: x-admin-key: <ADMIN_KEY>

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  return crypto.randomUUID();
}

function safeText(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function normalizeStatus(s) {
  const v = String(s || "").toLowerCase().trim();
  if (v === "pending" || v === "active" || v === "rejected") return v;
  return "";
}

function clampInt(v, fallback, min, max) {
  const n = Number.parseInt(String(v), 10);
  const val = Number.isFinite(n) ? n : fallback;
  return Math.max(min, Math.min(max, val));
}

function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
}

function requireAdmin(req, res, next) {
  const key = (process.env.ADMIN_KEY || "").trim();
  if (!key) return next(); // dev mode (open)
  const got = String(req.headers["x-admin-key"] || "").trim();
  if (!got || got !== key) return res.status(401).json({ success: false, error: "Unauthorized" });
  return next();
}

export default function registerAdminArtists(app) {
  // Use same base dir logic as artists.js (root)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const DATA_DIR = path.join(__dirname, "data");
  const DATA_FILE = path.join(DATA_DIR, "artists.json");

  function ensureDataDir() {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch {
      // ignore
    }
  }

  function loadArtists() {
    try {
      ensureDataDir();
      if (!fs.existsSync(DATA_FILE)) return [];
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveArtists(list) {
    try {
      ensureDataDir();
      fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), "utf8");
      return true;
    } catch {
      return false;
    }
  }

  function findIndexById(list, id) {
    const clean = safeText(id);
    return list.findIndex(
      (a) => safeText(a?.id) === clean || safeText(a?._id) === clean || safeText(a?.slug) === clean
    );
  }

  function sanitizePatch(body) {
    const allowed = ["name", "genre", "location", "bio", "imageUrl", "links", "tracks", "status"];
    const patch = pick(body || {}, allowed);

    if (patch.status !== undefined) {
      const s = normalizeStatus(patch.status);
      if (!s) delete patch.status;
      else patch.status = s;
    }

    if (patch.links !== undefined && (patch.links === null || typeof patch.links !== "object" || Array.isArray(patch.links))) {
      delete patch.links;
    }

    if (patch.tracks !== undefined) patch.tracks = ensureArray(patch.tracks);

    return patch;
  }

  function paginate(items, page, limit) {
    const p = clampInt(page, 1, 1, 999999);
    const l = clampInt(limit, 25, 1, 100);
    const total = items.length;
    const pages = Math.max(1, Math.ceil(total / l));
    const start = (p - 1) * l;
    const end = start + l;
    return { page: p, limit: l, total, pages, data: items.slice(start, end) };
  }

  const LIST_ROUTES = ["/admin/artists", "/api/admin/artists"];
  const ONE_ROUTES = ["/admin/artists/:id", "/api/admin/artists/:id"];

  // LIST
  app.get(LIST_ROUTES, requireAdmin, (req, res) => {
    try {
      const status = normalizeStatus(req.query.status);
      const q = String(req.query.q || "").trim().toLowerCase();
      const page = req.query.page;
      const limit = req.query.limit;

      let all = ensureArray(loadArtists());

      // ensure basic fields
      all = all.map((a) => ({
        ...a,
        id: safeText(a.id) || safeText(a._id) || safeText(a.slug) || makeId(),
        status: normalizeStatus(a.status) || "active",
        createdAt: a.createdAt || nowIso(),
        updatedAt: a.updatedAt || nowIso(),
      }));

      // filter
      if (status) all = all.filter((a) => (normalizeStatus(a.status) || "active") === status);

      if (q) {
        all = all.filter((a) => {
          const hay = `${safeText(a.id)} ${safeText(a.name)} ${safeText(a.genre)} ${safeText(a.location)} ${safeText(a.bio)}`
            .toLowerCase();
          return hay.includes(q);
        });
      }

      // sort newest first
      all.sort((a, b) => {
        const tb = Date.parse(b.createdAt || "") || 0;
        const ta = Date.parse(a.createdAt || "") || 0;
        if (tb !== ta) return tb - ta;
        return safeText(a.name).localeCompare(safeText(b.name));
      });

      const paged = paginate(all, page, limit);
      return res.json({ success: true, ...paged });
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || "Server error" });
    }
  });

  // GET ONE
  app.get(ONE_ROUTES, requireAdmin, (req, res) => {
    try {
      const id = req.params.id;
      const all = ensureArray(loadArtists());
      const idx = findIndexById(all, id);
      if (idx === -1) return res.status(404).json({ success: false, error: "Not found" });
      return res.json({ success: true, data: all[idx] });
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || "Server error" });
    }
  });

  // PATCH
  app.patch(ONE_ROUTES, requireAdmin, (req, res) => {
    try {
      const id = req.params.id;
      const all = ensureArray(loadArtists());
      const idx = findIndexById(all, id);
      if (idx === -1) return res.status(404).json({ success: false, error: "Not found" });

      const patch = sanitizePatch(req.body);
      const existing = all[idx] || {};
      const updated = { ...existing, ...patch, updatedAt: nowIso() };
      all[idx] = updated;

      saveArtists(all);
      return res.json({ success: true, data: updated });
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || "Server error" });
    }
  });

  // APPROVE
  app.post(["/admin/artists/:id/approve", "/api/admin/artists/:id/approve"], requireAdmin, (req, res) => {
    try {
      const id = req.params.id;
      const all = ensureArray(loadArtists());
      const idx = findIndexById(all, id);
      if (idx === -1) return res.status(404).json({ success: false, error: "Not found" });

      const updated = { ...(all[idx] || {}), status: "active", updatedAt: nowIso() };
      all[idx] = updated;
      saveArtists(all);

      return res.json({ success: true, data: updated });
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || "Server error" });
    }
  });

  // REJECT
  app.post(["/admin/artists/:id/reject", "/api/admin/artists/:id/reject"], requireAdmin, (req, res) => {
    try {
      const id = req.params.id;
      const all = ensureArray(loadArtists());
      const idx = findIndexById(all, id);
      if (idx === -1) return res.status(404).json({ success: false, error: "Not found" });

      const updated = { ...(all[idx] || {}), status: "rejected", updatedAt: nowIso() };
      all[idx] = updated;
      saveArtists(all);

      return res.json({ success: true, data: updated });
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || "Server error" });
    }
  });

  // RESTORE -> pending
  app.post(["/admin/artists/:id/restore", "/api/admin/artists/:id/restore"], requireAdmin, (req, res) => {
    try {
      const id = req.params.id;
      const all = ensureArray(loadArtists());
      const idx = findIndexById(all, id);
      if (idx === -1) return res.status(404).json({ success: false, error: "Not found" });

      const updated = { ...(all[idx] || {}), status: "pending", updatedAt: nowIso() };
      all[idx] = updated;
      saveArtists(all);

      return res.json({ success: true, data: updated });
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || "Server error" });
    }
  });

  // DELETE (hard delete from json for admin moderation)
  app.delete(ONE_ROUTES, requireAdmin, (req, res) => {
    try {
      const id = req.params.id;
      const all = ensureArray(loadArtists());
      const idx = findIndexById(all, id);
      if (idx === -1) return res.status(404).json({ success: false, error: "Not found" });

      all.splice(idx, 1);
      saveArtists(all);

      return res.json({ success: true, data: { id: safeText(id), deleted: true } });
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || "Server error" });
    }
  });

  // STATS
  app.get(["/admin/stats", "/api/admin/stats"], requireAdmin, (req, res) => {
    try {
      const all = ensureArray(loadArtists());
      const counts = { pending: 0, active: 0, rejected: 0, total: all.length };

      for (const a of all) {
        const s = normalizeStatus(a?.status) || "active";
        if (counts[s] !== undefined) counts[s] += 1;
      }

      return res.json({ success: true, data: counts });
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || "Server error" });
    }
  });
}