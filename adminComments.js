// adminComments.js (ESM)
// Admin comments control router
//
// Option A upgrades:
// - bulk delete
// - status moderation (visible/hidden/approved/pending)
// - flag / clear flags
// - list filters (by status, by artistId, flagged only)

import express from "express";
import commentsStore from "./commentsStore.js";

const router = express.Router();

/**
 * Helpers
 */
function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function asString(v) {
  return String(v ?? "").trim();
}

function parseIds(input) {
  if (Array.isArray(input)) return input.map((x) => String(x));
  if (typeof input === "string") {
    // allow "1,2,3"
    return input
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x.length > 0);
  }
  return [];
}

/**
 * GET /api/admin/comments
 * Query params:
 * - artistId=1
 * - status=visible|hidden|approved|pending
 * - flagged=true
 */
router.get("/", (req, res) => {
  let comments = commentsStore.getAll();

  const artistId = isNonEmptyString(req.query.artistId) ? String(req.query.artistId) : null;
  const status = isNonEmptyString(req.query.status) ? String(req.query.status).toLowerCase() : null;
  const flagged = String(req.query.flagged || "").toLowerCase() === "true";

  if (artistId) {
    comments = comments.filter((c) => c.artistId === String(artistId));
  }

  if (status) {
    comments = comments.filter((c) => String(c.status || "").toLowerCase() === status);
  }

  if (flagged) {
    comments = comments.filter((c) => Array.isArray(c.flags) && c.flags.length > 0);
  }

  return res.status(200).json({
    success: true,
    count: comments.length,
    comments,
  });
});

/**
 * GET /api/admin/comments/:id
 */
router.get("/:id", (req, res) => {
  const comment = commentsStore.getById(req.params.id);
  if (!comment) {
    return res.status(404).json({ success: false, message: "Comment not found." });
  }
  return res.status(200).json({ success: true, comment });
});

/**
 * POST /api/admin/comments
 * Create a comment (admin)
 * Body: { artistId, author, text }
 */
router.post("/", (req, res) => {
  try {
    const artistId = asString(req.body?.artistId);
    const author = asString(req.body?.author);
    const text = asString(req.body?.text);

    if (!artistId) {
      return res.status(400).json({ success: false, message: "Validation error: 'artistId' is required." });
    }
    if (!author) {
      return res.status(400).json({ success: false, message: "Validation error: 'author' is required." });
    }
    if (!text) {
      return res.status(400).json({ success: false, message: "Validation error: 'text' is required." });
    }

    const created = commentsStore.create({ artistId, author, text });

    return res.status(201).json({
      success: true,
      message: "Comment created successfully.",
      comment: created,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err?.message || "Invalid request.",
    });
  }
});

/**
 * PUT /api/admin/comments/:id
 * Full replace (requires artistId, author, text)
 * Optional: status
 */
router.put("/:id", (req, res) => {
  const existing = commentsStore.getById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "Comment not found." });
  }

  const artistId = asString(req.body?.artistId);
  const author = asString(req.body?.author);
  const text = asString(req.body?.text);
  const status = req.body?.status;

  if (!artistId || !author || !text) {
    return res.status(400).json({
      success: false,
      message: "Validation error: 'artistId', 'author', and 'text' are required.",
    });
  }

  const updated = commentsStore.update(req.params.id, { artistId, author, text, status });
  if (!updated) {
    return res.status(400).json({
      success: false,
      message: "Update failed (invalid fields).",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Comment updated successfully.",
    comment: updated,
  });
});

/**
 * PATCH /api/admin/comments/:id
 * Partial update
 * Supports moderation:
 * - status (visible|hidden|approved|pending)
 * - moderatedBy
 */
router.patch("/:id", (req, res) => {
  const existing = commentsStore.getById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "Comment not found." });
  }

  const patch = {};

  if (req.body?.artistId !== undefined) patch.artistId = asString(req.body.artistId);
  if (req.body?.author !== undefined) patch.author = asString(req.body.author);
  if (req.body?.text !== undefined) patch.text = asString(req.body.text);

  if (req.body?.status !== undefined) patch.status = req.body.status;
  if (req.body?.moderatedBy !== undefined) patch.moderatedBy = asString(req.body.moderatedBy);

  const updated = commentsStore.patch(req.params.id, patch);
  if (!updated) {
    return res.status(400).json({
      success: false,
      message: "Patch failed (invalid fields).",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Comment patched successfully.",
    comment: updated,
  });
});

/**
 * POST /api/admin/comments/:id/flag
 * Body: { code, reason }
 */
router.post("/:id/flag", (req, res) => {
  const existing = commentsStore.getById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "Comment not found." });
  }

  const code = asString(req.body?.code) || "flag";
  const reason = asString(req.body?.reason) || "";

  const updated = commentsStore.addFlag(req.params.id, { code, reason });
  if (!updated) {
    return res.status(400).json({ success: false, message: "Could not flag comment." });
  }

  return res.status(200).json({
    success: true,
    message: "Comment flagged.",
    comment: updated,
  });
});

/**
 * POST /api/admin/comments/:id/flags/clear
 */
router.post("/:id/flags/clear", (req, res) => {
  const existing = commentsStore.getById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "Comment not found." });
  }

  const updated = commentsStore.clearFlags(req.params.id);
  if (!updated) {
    return res.status(400).json({ success: false, message: "Could not clear flags." });
  }

  return res.status(200).json({
    success: true,
    message: "Flags cleared.",
    comment: updated,
  });
});

/**
 * POST /api/admin/comments/bulk/delete
 * Body: { ids: ["1","2"] } or { ids: "1,2,3" }
 */
router.post("/bulk/delete", (req, res) => {
  const ids = parseIds(req.body?.ids);
  if (ids.length === 0) {
    return res.status(400).json({ success: false, message: "ids is required (array or comma-separated string)." });
  }

  const result = commentsStore.bulkRemove(ids);

  return res.status(200).json({
    success: true,
    message: "Bulk delete complete.",
    deletedIds: result.deletedIds,
    notFoundIds: result.notFoundIds,
  });
});

/**
 * POST /api/admin/comments/bulk/status
 * Body: { ids: ["1","2"], status: "hidden", moderatedBy: "Admin" }
 */
router.post("/bulk/status", (req, res) => {
  const ids = parseIds(req.body?.ids);
  const status = req.body?.status;
  const moderatedBy = asString(req.body?.moderatedBy);

  if (ids.length === 0) {
    return res.status(400).json({ success: false, message: "ids is required (array or comma-separated string)." });
  }
  if (!status) {
    return res.status(400).json({ success: false, message: "status is required." });
  }

  const result = commentsStore.bulkSetStatus(ids, status, moderatedBy);
  if (!result) {
    return res.status(400).json({ success: false, message: "Invalid status. Use visible|hidden|approved|pending." });
  }

  return res.status(200).json({
    success: true,
    message: "Bulk status update complete.",
    status: result.status,
    updatedIds: result.updatedIds,
    notFoundIds: result.notFoundIds,
  });
});

/**
 * POST /api/admin/comments/reset
 * Deletes all comments
 */
router.post("/reset", (req, res) => {
  const deleted = commentsStore.reset();
  return res.status(200).json({
    success: true,
    deleted,
    message: "All comments have been deleted.",
  });
});

/**
 * POST /api/admin/comments/seed
 */
router.post("/seed", (req, res) => {
  const seeded = typeof commentsStore.seed === "function" ? commentsStore.seed() : 0;
  return res.status(200).json({
    success: true,
    seeded,
    message: "Demo comments seeded successfully.",
  });
});

export default router;