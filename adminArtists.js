/**
 * adminArtists.js (ESM ONLY — LOCKED)
 *
 * Admin moderation routes for artists.
 * Depends on artistsStore.js (ESM).
 *
 * Endpoints:
 * - GET    /admin/artists
 * - GET    /admin/stats
 * - POST   /admin/artists/:id/approve
 * - POST   /admin/artists/:id/reject
 *
 * Optional auth:
 * - If ADMIN_KEY env var exists → require header x-admin-key
 */

import {
  listArtists,
  getArtist,
  updateArtist,
  save,
} from "./artistsStore.js";

/* -------------------- Helpers -------------------- */

function requireAdmin(req, res, next) {
  const key = (process.env.ADMIN_KEY || "").trim();
  if (!key) return next(); // dev mode open
  if (req.headers["x-admin-key"] !== key) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  next();
}

function normalizeStatus(s) {
  const v = String(s || "").toLowerCase().trim();
  if (["pending", "active", "rejected"].includes(v)) return v;
  return "pending";
}

/* -------------------- Register -------------------- */

export function registerAdminArtists(app) {
  /**
   * LIST ARTISTS
   * Optional query: ?status=pending|active|rejected
   */
  app.get("/admin/artists", requireAdmin, (req, res) => {
    const status = req.query.status;
    let artists = listArtists();

    if (status) {
      artists = artists.filter((a) => a.status === normalizeStatus(status));
    }

    res.json({
      success: true,
      page: 1,
      limit: artists.length,
      total: artists.length,
      data: artists,
    });
  });

  /**
   * STATS
   */
  app.get("/admin/stats", requireAdmin, (req, res) => {
    const artists = listArtists();
    const counts = { pending: 0, active: 0, rejected: 0 };

    artists.forEach((a) => {
      const s = normalizeStatus(a.status);
      counts[s]++;
    });

    res.json({ success: true, data: counts });
  });

  /**
   * APPROVE ARTIST
   */
  app.post("/admin/artists/:id/approve", requireAdmin, (req, res) => {
    const id = req.params.id;
    const artist = getArtist(id);

    if (!artist) {
      return res.status(404).json({ success: false, error: "Artist not found" });
    }

    const updated = updateArtist(id, { status: "active" });
    save();

    res.json({ success: true, data: updated });
  });

  /**
   * REJECT ARTIST
   */
  app.post("/admin/artists/:id/reject", requireAdmin, (req, res) => {
    const id = req.params.id;
    const artist = getArtist(id);

    if (!artist) {
      return res.status(404).json({ success: false, error: "Artist not found" });
    }

    const updated = updateArtist(id, { status: "rejected" });
    save();

    res.json({ success: true, data: updated });
  });
}