// adminComments.js (ESM)
// Admin comments control router
//
// Option A (LOCKED):
// Canonical statuses: pending / approved / hidden / rejected
//
// Endpoints:
// - GET    /api/admin/comments
// - GET    /api/admin/comments/:id
// - POST   /api/admin/comments
// - PATCH  /api/admin/comments/:id
// - DELETE /api/admin/comments/:id
// - POST   /api/admin/comments/:id/flag
// - POST   /api/admin/comments/:id/flags/clear
// - POST   /api/admin/comments/bulk/status
// - POST   /api/admin/comments/bulk/delete
// - POST   /api/admin/comments/reset
// - POST   /api/admin/comments/seed

import express from "express";
import commentsStore from "./commentsStore.js";

const router = express.Router();

const CANONICAL_STATUSES = ["pending", "approved", "hidden", "rejected"];

/* -------------------- Helpers -------------------- */
const asString = (v) => String(v ?? "").trim();

function parseIds(input) {
  if (Array.isArray(input)) return input.map((x) => asString(x)).filter(Boolean);
  if (typeof input === "string") {
    return input
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x.length > 0);
  }
  return [];
}

function normalizeStatus(status) {
  const s = asString(status).toLowerCase();
  return CANONICAL_STATUSES.includes(s) ? s : null;
}

function toBool(v) {
  return String(v ?? "").toLowerCase() === "true";
}

function jsonFail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

/* -------------------- Store Adapter (future-proof) -------------------- */
/**
 * We standardize calls here so admin routes won't break if store API changes.
 * Step A1 updated commentsStore — this adapter supports common names safely.
 */
const store = {
  listAdmin({ status, artistId, flagged } = {}) {
    // Preferred: commentsStore.listAdmin({ status, artistId, flagged })
    if (typeof commentsStore.listAdmin === "function") {
      return commentsStore.listAdmin({ status, artistId, flagged });
    }

    // Fallback: commentsStore.listAll() / getAll()
    const listAllFn =
      typeof commentsStore.listAll === "function"
        ? commentsStore.listAll.bind(commentsStore)
        : typeof commentsStore.getAll === "function"
        ? commentsStore.getAll.bind(commentsStore)
        : null;

    const rows = listAllFn ? listAllFn() : [];

    let filtered = rows;

    if (artistId) filtered = filtered.filter((c) => asString(c.artistId) === asString(artistId));
    if (status) filtered = filtered.filter((c) => asString(c.status).toLowerCase() === asString(status).toLowerCase());
    if (flagged) filtered = filtered.filter((c) => Array.isArray(c.flags) && c.flags.length > 0);

    return { ok: true, count: filtered.length, comments: filtered };
  },

  getById(id) {
    if (typeof commentsStore.getById === "function") return commentsStore.getById(id);
    if (typeof commentsStore.get === "function") return commentsStore.get(id);
    return null;
  },

  create({ artistId, author, text }) {
    if (typeof commentsStore.create === "function") return commentsStore.create({ artistId, author, text });
    return { ok: false, status: 500, message: "commentsStore.create is not implemented." };
  },

  patch(id, patch) {
    if (typeof commentsStore.patch === "function") return commentsStore.patch(id, patch);
    if (typeof commentsStore.update === "function") return commentsStore.update(id, patch);
    return null;
  },

  remove(id) {
    if (typeof commentsStore.remove === "function") return commentsStore.remove(id);
    if (typeof commentsStore.delete === "function") return commentsStore.delete(id);
    if (typeof commentsStore.bulkRemove === "function") {
      const r = commentsStore.bulkRemove([id]);
      return r?.deletedIds?.includes?.(id) ? true : false;
    }
    return false;
  },

  addFlag(id, { code, reason }) {
    if (typeof commentsStore.addFlag === "function") return commentsStore.addFlag(id, { code, reason });
    return null;
  },

  clearFlags(id) {
    if (typeof commentsStore.clearFlags === "function") return commentsStore.clearFlags(id);
    return null;
  },

  bulkUpdateStatus({ ids, status, moderatedBy, moderationNote }) {
    if (typeof commentsStore.bulkUpdateStatus === "function") {
      return commentsStore.bulkUpdateStatus({ ids, status, moderatedBy, moderationNote });
    }
    if (typeof commentsStore.bulkSetStatus === "function") {
      return commentsStore.bulkSetStatus(ids, status, moderatedBy);
    }
    return { ok: false, status: 500, message: "Bulk status update is not implemented." };
  },

  bulkRemove(ids) {
    if (typeof commentsStore.bulkRemove === "function") return commentsStore.bulkRemove(ids);
    return { deletedIds: [], notFoundIds: ids };
  },

  reset() {
    if (typeof commentsStore.reset === "function") return commentsStore.reset();
    return 0;
  },

  seed() {
    if (typeof commentsStore.seed === "function") return commentsStore.seed();
    return 0;
  },
};

/* -------------------- Routes -------------------- */

/**
 * GET /api/admin/comments
 * Query:
 *  - status=pending|approved|hidden|rejected
 *  - artistId=...
 *  - flagged=true
 */
router.get("/", (req, res) => {
  const statusRaw = asString(req.query.status);
  const artistId = asString(req.query.artistId);
  const flagged = toBool(req.query.flagged);

  const status = statusRaw ? normalizeStatus(statusRaw) : null;
  if (statusRaw && !status) {
    return jsonFail(res, 400, `Invalid status. Use: ${CANONICAL_STATUSES.join(" | ")}`);
  }

  const result = store.listAdmin({
    status: status || undefined,
    artistId: artistId || undefined,
    flagged: flagged || undefined,
  });

  if (!result || result.ok === false) {
    return jsonFail(res, result?.status || 500, result?.message || "Failed to list comments.");
  }

  return res.status(200).json({
    success: true,
    count: result.count ?? (Array.isArray(result.comments) ? result.comments.length : 0),
    comments: result.comments ?? [],
  });
});

/**
 * GET /api/admin/comments/:id
 */
router.get("/:id", (req, res) => {
  const comment = store.getById(req.params.id);
  if (!comment) return jsonFail(res, 404, "Comment not found.");
  return res.status(200).json({ success: true, comment });
});

/**
 * POST /api/admin/comments
 * Body: { artistId, author, text }
 */
router.post("/", (req, res) => {
  const artistId = asString(req.body?.artistId);
  const author = asString(req.body?.author);
  const text = asString(req.body?.text);

  if (!artistId) return jsonFail(res, 400, "Validation error: 'artistId' is required.");
  if (!author) return jsonFail(res, 400, "Validation error: 'author' is required.");
  if (!text) return jsonFail(res, 400, "Validation error: 'text' is required.");

  const created = store.create({ artistId, author, text });

  // Store may return { ok:true, comment } OR a comment directly.
  if (created?.ok === false) {
    return jsonFail(res, created.status || 400, created.message || "Could not create comment.");
  }

  const comment = created?.comment ? created.comment : created;

  return res.status(201).json({
    success: true,
    message: "Comment created successfully.",
    comment,
  });
});

/**
 * PATCH /api/admin/comments/:id
 * Body supports:
 *  - artistId, author, text
 *  - status: pending|approved|hidden|rejected
 *  - moderatedBy, moderationNote
 */
router.patch("/:id", (req, res) => {
  const existing = store.getById(req.params.id);
  if (!existing) return jsonFail(res, 404, "Comment not found.");

  const patch = {};

  if (req.body?.artistId !== undefined) patch.artistId = asString(req.body.artistId);
  if (req.body?.author !== undefined) patch.author = asString(req.body.author);
  if (req.body?.text !== undefined) patch.text = asString(req.body.text);

  if (req.body?.status !== undefined) {
    const s = normalizeStatus(req.body.status);
    if (!s) return jsonFail(res, 400, `Invalid status. Use: ${CANONICAL_STATUSES.join(" | ")}`);
    patch.status = s;
  }

  if (req.body?.moderatedBy !== undefined) patch.moderatedBy = asString(req.body.moderatedBy);
  if (req.body?.moderationNote !== undefined) patch.moderationNote = asString(req.body.moderationNote);

  const updated = store.patch(req.params.id, patch);

  if (!updated) return jsonFail(res, 400, "Comment not found or invalid fields.");
  if (updated?.ok === false) return jsonFail(res, updated.status || 400, updated.message || "Patch failed.");

  const comment = updated?.comment ? updated.comment : updated;

  return res.status(200).json({
    success: true,
    message: "Comment patched successfully.",
    comment,
  });
});

/**
 * DELETE /api/admin/comments/:id
 */
router.delete("/:id", (req, res) => {
  const existing = store.getById(req.params.id);
  if (!existing) return jsonFail(res, 404, "Comment not found.");

  const ok = store.remove(req.params.id);
  if (!ok) return jsonFail(res, 400, "Could not delete comment.");

  return res.status(200).json({
    success: true,
    message: "Comment deleted successfully.",
    deletedId: req.params.id,
  });
});

/**
 * POST /api/admin/comments/:id/flag
 * Body: { code, reason }
 */
router.post("/:id/flag", (req, res) => {
  const existing = store.getById(req.params.id);
  if (!existing) return jsonFail(res, 404, "Comment not found.");

  const code = asString(req.body?.code) || "flag";
  const reason = asString(req.body?.reason) || "";

  const updated = store.addFlag(req.params.id, { code, reason });
  if (!updated) return jsonFail(res, 400, "Could not flag comment.");

  return res.status(200).json({
    success: true,
    message: "Comment flagged.",
    comment: updated?.comment ? updated.comment : updated,
  });
});

/**
 * POST /api/admin/comments/:id/flags/clear
 */
router.post("/:id/flags/clear", (req, res) => {
  const existing = store.getById(req.params.id);
  if (!existing) return jsonFail(res, 404, "Comment not found.");

  const updated = store.clearFlags(req.params.id);
  if (!updated) return jsonFail(res, 400, "Could not clear flags.");

  return res.status(200).json({
    success: true,
    message: "Flags cleared.",
    comment: updated?.comment ? updated.comment : updated,
  });
});

/**
 * POST /api/admin/comments/bulk/status
 * Body: { ids: ["id1","id2"], status: "hidden", moderatedBy: "...", moderationNote: "..." }
 */
router.post("/bulk/status", (req, res) => {
  const ids = parseIds(req.body?.ids);
  const status = normalizeStatus(req.body?.status);
  const moderatedBy = asString(req.body?.moderatedBy);
  const moderationNote = asString(req.body?.moderationNote);

  if (ids.length === 0) return jsonFail(res, 400, "ids is required (array or comma-separated string).");
  if (!status) return jsonFail(res, 400, `Invalid status. Use: ${CANONICAL_STATUSES.join(" | ")}`);

  const result = store.bulkUpdateStatus({ ids, status, moderatedBy, moderationNote });

  if (!result || result.ok === false) {
    return jsonFail(res, result?.status || 400, result?.message || "Bulk status update failed.");
  }

  return res.status(200).json({
    success: true,
    message: "Bulk status update complete.",
    status: result.status || status,
    updated: result.updated ?? result.updatedIds?.length ?? 0,
    missing: result.missing ?? result.notFoundIds ?? [],
  });
});

/**
 * POST /api/admin/comments/bulk/delete
 * Body: { ids: ["id1","id2"] } or { ids: "id1,id2" }
 */
router.post("/bulk/delete", (req, res) => {
  const ids = parseIds(req.body?.ids);
  if (ids.length === 0) return jsonFail(res, 400, "ids is required (array or comma-separated string).");

  const result = store.bulkRemove(ids);

  return res.status(200).json({
    success: true,
    message: "Bulk delete complete.",
    deletedIds: result.deletedIds ?? [],
    notFoundIds: result.notFoundIds ?? [],
  });
});

/**
 * POST /api/admin/comments/reset
 * Deletes all comments
 */
router.post("/reset", (_req, res) => {
  const deleted = store.reset();
  return res.status(200).json({
    success: true,
    deleted,
    message: "All comments deleted.",
  });
});

/**
 * POST /api/admin/comments/seed
 */
router.post("/seed", (_req, res) => {
  const seeded = store.seed();
  return res.status(200).json({
    success: true,
    seeded,
    message: "Demo comments seeded successfully.",
  });
});

export default router;