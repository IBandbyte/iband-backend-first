/**
 * adminArtists.js (ESM)
 * Phase 2.2.3 — Admin Moderation Panel (Artists)
 *
 * Provides:
 * - GET    /admin/artists?status=pending&q=...&page=1&limit=25
 * - GET    /admin/artists/:id
 * - PATCH  /admin/artists/:id
 * - POST   /admin/artists/:id/approve
 * - POST   /admin/artists/:id/reject
 * - POST   /admin/artists/:id/restore
 * - DELETE /admin/artists/:id
 * - GET    /admin/stats
 *
 * Also mirrors under /api/admin/* for future flexibility.
 *
 * Auth:
 * - If ADMIN_KEY is set on backend: require header x-admin-key
 * - Otherwise open (dev mode)
 */

import * as StoreImport from "./artistsStore.js";

function makeId(raw) {
  if (raw === null || raw === undefined) return "";
  return String(raw);
}

function nowIso() {
  return new Date().toISOString();
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
}

function normalizeStatus(s) {
  const v = String(s || "").toLowerCase().trim();
  if (!v) return "";
  if (v === "pending" || v === "active" || v === "rejected") return v;
  return "";
}

function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

/**
 * Optional admin auth:
 * - If process.env.ADMIN_KEY exists: require header "x-admin-key" match
 * - If not set: allow all (dev)
 */
function requireAdmin(req, res, next) {
  const key = String(process.env.ADMIN_KEY || "").trim();
  if (!key) return next(); // dev mode

  const got = String(req.headers["x-admin-key"] || "").trim();
  if (!got || got !== key) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  return next();
}

function paginate(items, page, limit) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 25));
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / l));
  const start = (p - 1) * l;
  const end = start + l;
  return {
    page: p,
    limit: l,
    total,
    pages,
    data: items.slice(start, end),
  };
}

function sanitizePatch(body) {
  // Allow only safe editable fields for admin PATCH
  const allowed = ["name", "genre", "location", "bio", "imageUrl", "socials", "tracks", "status"];
  const patch = pick(body || {}, allowed);

  if (patch.status) {
    const s = normalizeStatus(patch.status);
    if (!s) delete patch.status;
    else patch.status = s;
  }

  if (patch.socials && typeof patch.socials !== "object") delete patch.socials;
  if (patch.tracks) patch.tracks = ensureArray(patch.tracks);

  return patch;
}

/**
 * Defensive adapter around artistsStore.js
 * Supports BOTH patterns:
 * - ESM named exports: listArtists/getArtist/updateArtist/deleteArtist/save (any of these)
 * - ESM default export object with methods
 * - CJS imported via default (Node interop) (if ever used)
 */
function createArtistsStoreAdapter(storeAny) {
  const store =
    (storeAny && storeAny.default && typeof storeAny.default === "object" ? storeAny.default : storeAny) || {};

  const fn = (names) => names.map((n) => store[n]).find((f) => typeof f === "function");

  const listFn = fn(["listArtists", "getArtists", "allArtists", "list"]);
  const getFn = fn(["getArtist", "findById", "getById", "findArtist"]);
  const updateFn = fn(["updateArtist", "updateById", "editArtist", "patchArtist"]);
  const deleteFn = fn(["deleteArtist", "removeArtist", "deleteById", "removeById"]);
  const saveFn = fn(["save", "persist", "write", "flush"]);

  // fallback data references (in-memory store style)
  const getArrayRef = () => {
    if (Array.isArray(store.artists)) return store.artists;
    if (Array.isArray(store.data)) return store.data;
    if (store.db && Array.isArray(store.db.artists)) return store.db.artists;
    return null;
  };

  async function list() {
    if (listFn) return await listFn();
    const arr = getArrayRef();
    return arr ? arr : [];
  }

  async function get(id) {
    const cleanId = makeId(id);
    if (!cleanId) return null;

    if (getFn) return await getFn(cleanId);

    const arr = ensureArray(await list());
    return (
      arr.find((a) => makeId(a.id) === cleanId) ||
      arr.find((a) => makeId(a._id) === cleanId) ||
      arr.find((a) => makeId(a.slug) === cleanId) ||
      null
    );
  }

  async function update(id, patch) {
    const cleanId = makeId(id);
    if (!cleanId) return null;

    if (updateFn) return await updateFn(cleanId, patch);

    // fallback mutate in-memory
    const arr = getArrayRef();
    if (!arr) return null;

    const idx = arr.findIndex(
      (a) => makeId(a.id) === cleanId || makeId(a._id) === cleanId || makeId(a.slug) === cleanId
    );
    if (idx === -1) return null;

    const existing = arr[idx] || {};
    const merged = { ...existing, ...patch, updatedAt: nowIso() };
    arr[idx] = merged;

    if (saveFn) {
      try {
        await saveFn();
      } catch {
        // ignore save errors in dev
      }
    }

    return merged;
  }

  async function remove(id) {
    const cleanId = makeId(id);
    if (!cleanId) return false;

    if (deleteFn) return await deleteFn(cleanId);

    const arr = getArrayRef();
    if (!arr) return false;

    const idx = arr.findIndex(
      (a) => makeId(a.id) === cleanId || makeId(a._id) === cleanId || makeId(a.slug) === cleanId
    );
    if (idx === -1) return false;

    arr.splice(idx, 1);

    if (saveFn) {
      try {
        await saveFn();
      } catch {
        // ignore
      }
    }

    return true;
  }

  return { list, get, update, remove };
}

export function registerAdminArtists(app) {
  const Artists = createArtistsStoreAdapter(StoreImport);

  // LIST
  app.get(["/admin/artists", "/api/admin/artists"], requireAdmin, async (req, res) => {
    try {
      const status = normalizeStatus(req.query.status);
      const q = String(req.query.q || "").trim().toLowerCase();
      const page = req.query.page;
      const limit = req.query.limit;

      let all = ensureArray(await Artists.list());

      // Normalize helper fields (do not mutate original objects)
      const normalized = all.map((a) => ({
        ...a,
        __id: makeId(a.id || a._id || a.slug || ""),
        __status: normalizeStatus(a.status) || "active",
        __name: String(a.name || "").toLowerCase(),
        __genre: String(a.genre || a.primaryGenre || "").toLowerCase(),
        __location: String(a.location || a.city || a.country || "").toLowerCase(),
      }));

      let filtered = normalized;

      if (status) filtered = filtered.filter((a) => a.__status === status);

      if (q) {
        filtered = filtered.filter((a) => {
          const hay = [a.__id, a.__name, a.__genre, a.__location, String(a.bio || "").toLowerCase()]
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        });
      }

      // Sort newest-first if createdAt exists, else stable by name
      filtered.sort((a, b) => {
        const ta = Date.parse(a.createdAt || "") || 0;
        const tb = Date.parse(b.createdAt || "") || 0;
        if (tb !== ta) return tb - ta;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });

      // strip internal helper props from output
      const out = filtered.map(({ __id, __status, __name, __genre, __location, ...rest }) => rest);

      return res.json({ success: true, ...paginate(out, page, limit) });
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || "Server error" });
    }
  });

  // GET ONE
  app.get(["/admin/artists/:id", "/api/admin/artists/:id"], requireAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      const artist = await Artists.get(id);
      if (!artist) return res.status(404).json({ success: false, error: "Not found" });
      return res.json({ success: true, data: artist });
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || "Server error" });
    }
  });

  // PATCH (edit fields)
  app.patch(["/admin/artists/:id", "/api/admin/artists/:id"], requireAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      const existing = await Artists.get(id);
      if (!existing) return res.status(404).json({ success: false, error: "Not found" });

      const patch = sanitizePatch(req.body);
      const updated = await Artists.update(id, { ...patch, updatedAt: nowIso() });

      return res.json({ success: true, data: updated || { ...existing, ...patch } });
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || "Server error" });
    }
  });

  // APPROVE
  app.post(["/admin/artists/:id/approve", "/api/admin/artists/:id/approve"], requireAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      const existing = await Artists.get(id);
      if (!existing) return res.status(404).json({ success: false, error: "Not found" });

      const updated = await Artists.update(id, { status: "active", updatedAt: nowIso() });
      return res.json({ success: true, data: updated || { ...existing, status: "active" } });
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || "Server error" });
    }
  });

  // REJECT
  app.post(["/admin/artists/:id/reject", "/api/admin/artists/:id/reject"], requireAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      const existing = await Artists.get(id);
      if (!existing) return res.status(404).json({ success: false, error: "Not found" });

      const updated = await Artists.update(id, { status: "rejected", updatedAt: nowIso() });
      return res.json({ success: true, data: updated || { ...existing, status: "rejected" } });
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || "Server error" });
    }
  });

  // RESTORE → pending
  app.post(["/admin/artists/:id/restore", "/api/admin/artists/:id/restore"], requireAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      const existing = await Artists.get(id);
      if (!existing) return res.status(404).json({ success: false, error: "Not found" });

      const updated = await Artists.update(id, { status: "pending", updatedAt: nowIso() });
      return res.json({ success: true, data: updated || { ...existing, status: "pending" } });
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || "Server error" });
    }
  });

  // DELETE
  app.delete(["/admin/artists/:id", "/api/admin/artists/:id"], requireAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      const existing = await Artists.get(id);
      if (!existing) return res.status(404).json({ success: false, error: "Not found" });

      const ok = await Artists.remove(id);
      return res.json({ success: true, data: { id: makeId(id), deleted: !!ok } });
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || "Server error" });
    }
  });

  // SIMPLE STATS (counts by status)
  app.get(["/admin/stats", "/api/admin/stats"], requireAdmin, async (req, res) => {
    try {
      const all = ensureArray(await Artists.list());
      const counts = { pending: 0, active: 0, rejected: 0, total: all.length };

      for (const a of all) {
        const s = normalizeStatus(a.status) || "active";
        if (counts[s] !== undefined) counts[s] += 1;
      }

      return res.json({ success: true, data: counts });
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || "Server error" });
    }
  });
}