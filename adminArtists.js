// adminArtists.js — ESM ONLY
// Admin moderation routes for artists

import {
  listArtists,
  getArtist,
  updateArtist,
  save,
} from "./artistsStore.js";

/**
 * Register admin artist moderation routes
 * @param {import("express").Express} app
 */
export function registerAdminArtists(app) {
  // ----------------------
  // Middleware
  // ----------------------
  function requireAdmin(req, res, next) {
    const expected = (process.env.ADMIN_KEY || "").trim();
    if (!expected) return next(); // dev mode
    if (req.headers["x-admin-key"] !== expected) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    next();
  }

  function normalizeStatus(s) {
    return ["pending", "active", "rejected"].includes(s) ? s : "pending";
  }

  // ----------------------
  // Routes
  // ----------------------

  // GET /admin/artists
  app.get("/admin/artists", requireAdmin, (req, res) => {
    const status = req.query.status;
    let artists = listArtists();

    if (status) {
      artists = artists.filter((a) => a.status === status);
    }

    res.json({
      success: true,
      page: 1,
      limit: 25,
      total: artists.length,
      data: artists,
    });
  });

  // GET /admin/stats
  app.get("/admin/stats", requireAdmin, (req, res) => {
    const artists = listArtists();
    const counts = { pending: 0, active: 0, rejected: 0 };

    artists.forEach((a) => {
      const s = normalizeStatus(a.status);
      counts[s]++;
    });

    res.json({ success: true, data: counts });
  });

  // POST /admin/artists/:id/approve
  app.post("/admin/artists/:id/approve", requireAdmin, (req, res) => {
    const id = String(req.params.id);
    const artist = getArtist(id);

    if (!artist) {
      return res.status(404).json({ success: false, error: "Not found" });
    }

    const updated = updateArtist(id, {
      status: "active",
      updatedAt: new Date().toISOString(),
    });

    save();

    res.json({ success: true, data: updated });
  });

  // POST /admin/artists/:id/reject
  app.post("/admin/artists/:id/reject", requireAdmin, (req, res) => {
    const id = String(req.params.id);
    const artist = getArtist(id);

    if (!artist) {
      return res.status(404).json({ success: false, error: "Not found" });
    }

    const updated = updateArtist(id, {
      status: "rejected",
      updatedAt: new Date().toISOString(),
    });

    save();

    res.json({ success: true, data: updated });
  });
}