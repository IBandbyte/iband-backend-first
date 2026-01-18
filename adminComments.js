// adminComments.js (ESM)
// Admin comments control API — Option A (aligned with commentsStore.js)
//
// Mounted at: /api/admin/comments
// Admin features:
// - list/filter
// - get by id
// - create
// - put / patch
// - flag / clear flags
// - bulk status
// - bulk delete
// - reset / seed

import express from "express";
import commentsStore from "./commentsStore.js";

const router = express.Router();

/* -------------------- Helpers -------------------- */

const asString = (v) => String(v ?? "").trim();

function parseIds(input) {
  if (Array.isArray(input)) return input.map((x) => asString(x)).filter(Boolean);
  if (typeof input === "string") {
    return input
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

/* -------------------- Routes -------------------- */

/**
 * GET /api/admin/comments
 * Query:
 * - artistId
 * - status
 */
router.get("/", (req, res) => {
  let comments = commentsStore.getAll();

  const artistId = req.query.artistId ? asString(req.query.artistId) : null;
  const status = req.query.status ? asString(req.query.status).toLowerCase() : null;

  if (artistId) comments = comments.filter((c) => c.artistId === artistId);
  if (status) comments = comments.filter((c) => String(c.status || "").toLowerCase() === status);

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
 * Create comment (admin)
 */
router.post("/", (req, res) => {
  try {
    const artistId = asString(req.body?.artistId);
    const author = asString(req.body?.author);
    const text = asString(req.body?.text);

    const created = commentsStore.create({ artistId, author, text });

    return res.status(201).json({
      success: true,
      message: "Comment created successfully.",
      comment: created,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err?.message || "Invalid request." });
  }
});

/**
 * PUT /api/admin/comments/:id
 * Full replace (requires artistId, author, text)
 * Optional: status, moderatedBy, moderationNote
 */
router.put("/:id", (req, res) => {
  const updated = commentsStore.update(req.params.id, {
    artistId: asString(req.body?.artistId),
    author: asString(req.body?.author),
    text: asString(req.body?.text),
    status: req.body?.status,
  });

  if (!updated) {
    return res
      .status(404)
      .json({ success: false, message: "Comment not found or invalid fields." });
  }

  // Moderation metadata (optional)
  const patched = commentsStore.patch(req.params.id, {
    moderatedBy: asString(req.body?.moderatedBy),
    moderationNote: asString(req.body?.moderationNote),
  });

  return res.status(200).json({
    success: true,
    message: "Comment updated successfully.",
    comment: patched || updated,
  });
});

/**
 * PATCH /api/admin/comments/:id
 * Partial update / moderation
 */
router.patch("/:id", (req, res) => {
  const patched = commentsStore.patch(req.params.id, {
    artistId: req.body?.artistId,
    author: req.body?.author,
    text: req.body?.text,
    status: req.body?.status,
    moderatedBy: req.body?.moderatedBy,
    moderationNote: req.body?.moderationNote,
  });

  if (!patched) {
    return res
      .status(404)
      .json({ success: false, message: "Comment not found or invalid fields." });
  }

  return res.status(200).json({
    success: true,
    message: "Comment patched successfully.",
    comment: patched,
  });
});

/**
 * POST /api/admin/comments/:id/flag
 * Body: { code, reason }
 */
router.post("/:id/flag", (req, res) => {
  const updated = commentsStore.addFlag(req.params.id, {
    code: asString(req.body?.code),
    reason: asString(req.body?.reason),
  });

  if (!updated) {
    return res.status(404).json({ success: false, message: "Comment not found." });
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
  const updated = commentsStore.clearFlags(req.params.id);
  if (!updated) {
    return res.status(404).json({ success: false, message: "Comment not found." });
  }

  return res.status(200).json({
    success: true,
    message: "Flags cleared.",
    comment: updated,
  });
});

/**
 * POST /api/admin/comments/bulk/status
 * Body: { ids: ["id1","id2"], status: "approved|visible|hidden|pending|rejected", moderatedBy }
 */
router.post("/bulk/status", (req, res) => {
  const ids = parseIds(req.body?.ids);
  const status = req.body?.status;
  const moderatedBy = asString(req.body?.moderatedBy);

  if (!ids.length) {
    return res.status(400).json({ success: false, message: "ids is required." });
  }
  if (!status) {
    return res.status(400).json({ success: false, message: "status is required." });
  }

  const result = commentsStore.bulkSetStatus(ids, status, moderatedBy);
  if (!result) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Allowed: ${commentsStore.ALLOWED_STATUSES.join(", ")}`,
    });
  }

  return res.status(200).json({
    success: true,
    message: "Bulk status update complete.",
    ...result,
  });
});

/**
 * POST /api/admin/comments/bulk/delete
 * Body: { ids: ["id1","id2"] }
 */
router.post("/bulk/delete", (req, res) => {
  const ids = parseIds(req.body?.ids);
  if (!ids.length) {
    return res.status(400).json({ success: false, message: "ids is required." });
  }

  const result = commentsStore.bulkRemove(ids);

  return res.status(200).json({
    success: true,
    message: "Bulk delete complete.",
    ...result,
  });
});

/**
 * POST /api/admin/comments/reset
 */
router.post("/reset", (_req, res) => {
  const deleted = commentsStore.reset();
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
  const seeded = commentsStore.seed();
  return res.status(200).json({
    success: true,
    seeded,
    message: "Demo comments seeded.",
  });
});

export default router;