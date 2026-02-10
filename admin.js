// admin.js (ESM)
// iBand Backend — Admin Router (authoritative, future-proof)
// Mounted at: /api/admin
//
// Winning pattern/formula:
// - consistent JSON responses
// - safe admin auth (dev-open if ADMIN_KEY not set)
// - store-compat (getArtist/getById + patchArtist/patch + listArtists/list)
// - NO route collisions with adminArtists.js
// - includes non-colliding "core" admin fallback routes at /api/admin/core/*

import express from "express";

import artistsStore from "./artistsStore.js";

import adminArtistsRouter from "./adminArtists.js";
import adminCommentsRouter from "./adminComments.js";

const router = express.Router();

/* -------------------- Helpers -------------------- */

function safeText(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function isValidStatus(s) {
  const v = safeText(s).toLowerCase();
  return v === "pending" || v === "active" || v === "rejected";
}

function normalizeStatusQuery(v) {
  const s = safeText(v).toLowerCase();
  if (!s) return "all";
  if (["pending", "active", "rejected"].includes(s)) return s;
  if (["all", "*"].includes(s)) return "all";
  return "all";
}

function getStoreFns(store) {
  const getArtist =
    typeof store.getArtist === "function"
      ? store.getArtist.bind(store)
      : typeof store.getById === "function"
      ? store.getById.bind(store)
      : null;

  const patchArtist =
    typeof store.patchArtist === "function"
      ? store.patchArtist.bind(store)
      : typeof store.patch === "function"
      ? store.patch.bind(store)
      : null;

  const listArtists =
    typeof store.listArtists === "function"
      ? store.listArtists.bind(store)
      : typeof store.list === "function"
      ? store.list.bind(store)
      : null;

  return { getArtist, patchArtist, listArtists };
}

const { getArtist, patchArtist, listArtists } = getStoreFns(artistsStore);

function notFoundHint(id) {
  return {
    success: false,
    message: "Artist not found.",
    id,
    hint:
      "If this worked before a redeploy and fails after, your Render filesystem/in-memory store likely reset. Use a seed endpoint or add persistent storage (Render Disk / database).",
  };
}

function storeMisconfigured(res) {
  return res.status(500).json({
    success: false,
    message:
      "Admin API misconfigured: artistsStore is missing getArtist/getById or patchArtist/patch.",
  });
}

function getAdminMode() {
  const configuredKey = safeText(process.env.ADMIN_KEY);
  return configuredKey ? "locked" : "dev-open";
}

/* -------------------- Admin Key Guard -------------------- */
// Protects admin routes using x-admin-key header.
// If ADMIN_KEY is NOT set, it runs in "dev-open" mode (no auth) to avoid blocking testing.

router.use((req, res, next) => {
  // Fail fast if store is broken (consistent errors)
  if (!getArtist || !patchArtist) return storeMisconfigured(res);

  const configuredKey = safeText(process.env.ADMIN_KEY);

  if (!configuredKey) {
    req._adminMode = "dev-open";
    return next();
  }

  const provided = safeText(req.headers["x-admin-key"]);
  if (!provided || provided !== configuredKey) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized (missing or invalid x-admin-key).",
      mode: "locked",
    });
  }

  req._adminMode = "locked";
  next();
});

/* -------------------- Health -------------------- */

router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "iBand admin API is running",
    mode: req._adminMode || getAdminMode(),
  });
});

/* -------------------- Core Fallback Routes (NON-colliding) -------------------- */
/**
 * These exist to guarantee core admin actions work even if adminArtists.js is incomplete.
 * IMPORTANT: We do NOT use /artists here to avoid collisions with adminArtistsRouter.
 *
 * Namespace:
 *   /api/admin/core/artists
 */

router.get("/core/artists", (req, res) => {
  const status = normalizeStatusQuery(req.query?.status);

  if (!listArtists) {
    return res.json({
      success: true,
      artists: [],
      count: 0,
      status,
      note:
        "artistsStore.listArtists/list not available. Core listing disabled in this build.",
      mode: req._adminMode || getAdminMode(),
    });
  }

  const all = listArtists();
  const list = Array.isArray(all) ? all : [];

  const filtered =
    status === "all"
      ? list
      : list.filter((a) => safeText(a?.status).toLowerCase() === status);

  return res.json({
    success: true,
    count: filtered.length,
    artists: filtered,
    status,
    mode: req._adminMode || getAdminMode(),
  });
});

router.get("/core/artists/:id", (req, res) => {
  const id = safeText(req.params.id);
  if (!id) {
    return res.status(400).json({
      success: false,
      message: "Artist id is required.",
    });
  }

  const artist = getArtist(id);
  if (!artist) return res.status(404).json(notFoundHint(id));

  return res.json({
    success: true,
    artist,
    mode: req._adminMode || getAdminMode(),
  });
});

router.patch("/core/artists/:id/approve", (req, res) => {
  const id = safeText(req.params.id);
  if (!id) {
    return res.status(400).json({ success: false, message: "Artist id is required." });
  }

  const artist = getArtist(id);
  if (!artist) return res.status(404).json(notFoundHint(id));

  const updated = patchArtist(id, { status: "active" });
  if (!updated) {
    return res.status(500).json({
      success: false,
      message: "Failed to approve artist.",
      id,
    });
  }

  return res.json({
    success: true,
    message: "Artist approved.",
    artist: updated,
    mode: req._adminMode || getAdminMode(),
  });
});

router.patch("/core/artists/:id/reject", (req, res) => {
  const id = safeText(req.params.id);
  if (!id) {
    return res.status(400).json({ success: false, message: "Artist id is required." });
  }

  const artist = getArtist(id);
  if (!artist) return res.status(404).json(notFoundHint(id));

  const reason = safeText(req.body?.reason);
  const payload = reason
    ? { status: "rejected", rejectReason: reason }
    : { status: "rejected" };

  const updated = patchArtist(id, payload);
  if (!updated) {
    return res.status(500).json({
      success: false,
      message: "Failed to reject artist.",
      id,
    });
  }

  return res.json({
    success: true,
    message: "Artist rejected.",
    artist: updated,
    mode: req._adminMode || getAdminMode(),
  });
});

router.patch("/core/artists/:id/status", (req, res) => {
  const id = safeText(req.params.id);
  const nextStatus = safeText(req.body?.status).toLowerCase();

  if (!id) {
    return res.status(400).json({ success: false, message: "Artist id is required." });
  }
  if (!isValidStatus(nextStatus)) {
    return res.status(400).json({
      success: false,
      message: "Invalid status. Use: pending, active, rejected.",
      status: nextStatus,
    });
  }

  const artist = getArtist(id);
  if (!artist) return res.status(404).json(notFoundHint(id));

  const updated = patchArtist(id, { status: nextStatus });
  if (!updated) {
    return res.status(500).json({
      success: false,
      message: "Failed to update status.",
      id,
      status: nextStatus,
    });
  }

  return res.json({
    success: true,
    message: "Artist status updated.",
    artist: updated,
    mode: req._adminMode || getAdminMode(),
  });
});

/* -------------------- Sub Routers (authoritative modules) -------------------- */

router.use("/artists", adminArtistsRouter);
router.use("/comments", adminCommentsRouter);

export default router;