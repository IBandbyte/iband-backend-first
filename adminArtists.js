// adminArtists.js (ESM ONLY)

import { createRequire } from "module";
const require = createRequire(import.meta.url);

// artistsStore is CommonJS → load safely
const store = require("./artistsStore.js");

/**
 * Admin routes for artist moderation
 * ESM-only export
 */
export function registerAdminArtists(app) {
  // --- Helpers ---
  const normalizeStatus = (s) =>
    ["pending", "active", "rejected"].includes(s) ? s : "pending";

  const requireAdmin = (req, res, next) => {
    const key = (process.env.ADMIN_KEY || "").trim();
    if (!key) return next(); // dev mode
    if (req.headers["x-admin-key"] !== key) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    next();
  };

  const getArtists = () => store.artists || [];
  const findArtist = (id) =>
    getArtists().find((a) => String(a.id) === String(id));

  // --- ROUTES ---

  // LIST
  app.get("/admin/artists", requireAdmin, (req, res) => {
    const status = req.query.status;
    let artists = getArtists();

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

  // STATS
  app.get("/admin/stats", requireAdmin, (req, res) => {
    const artists = getArtists();
    const counts = { pending: 0, active: 0, rejected: 0 };

    artists.forEach((a) => {
      const s = normalizeStatus(a.status);
      counts[s]++;
    });

    res.json({ success: true, data: counts });
  });

  // APPROVE
  app.post("/admin/artists/:id/approve", requireAdmin, (req, res) => {
    const artist = findArtist(req.params.id);
    if (!artist) {
      return res.status(404).json({ success: false, error: "Not found" });
    }

    artist.status = "active";
    store.save?.();

    res.json({ success: true, data: artist });
  });

  // REJECT
  app.post("/admin/artists/:id/reject", requireAdmin, (req, res) => {
    const artist = findArtist(req.params.id);
    if (!artist) {
      return res.status(404).json({ success: false, error: "Not found" });
    }

    artist.status = "rejected";
    store.save?.();

    res.json({ success: true, data: artist });
  });
}