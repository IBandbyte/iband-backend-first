// adminComments.js (ESM)
// Admin comments control router — aligned with canonical commentsStore
//
// Admin capabilities:
// - list/filter comments
// - create comments
// - update / patch comments
// - moderate status
// - flag / clear flags
// - bulk delete / bulk status
// - reset / seed

import express from "express";
import commentsStore from "./commentsStore.js";

const router = express.Router();

/* -------------------- Helpers -------------------- */

const asString = (v) => String(v ?? "").trim();

function parseIds(input) {
  if (Array.isArray(input)) return input.map((x) => asString(x));
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
 * Optional query:
 * - artistId
 * - status
 */
router.get("/", (req, res) => {
  let rows = commentsStore.getAll();

  const artistId = req.query.artistId ? asString(req.query.artistId) : null;
  const status = req.query.status ? asString(req.query.status).toLowerCase() : null;

  if (artistId) rows = rows.filter((c) => c.artistId === artistId);
  if (status) rows = rows.filter((c) => c.status === status);

  return res.status(200).json({
    success: true,
    count: rows.length,
    comments: rows,
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
    const created = commentsStore.create({
      artistId: asString(req.body?.artistId),
      author: asString(req.body?.author),
      text: asString(req.body?.text),
    });

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
 * Full replace
 */
router.put("/:id", (req, res) => {
  const updated = commentsStore.update(req.params.id, {
    artistId: asString(req.body?.artistId),
    author: asString(req.body?.author),
    text: asString(req.body?.text),
    status: req.body?.status,
    moderatedBy: asString(req.body?.moderatedBy),
    moderationNote: asString(req.body?.moderationNote),
  });

  if (!updated) {
    return res.status(404).json({ success: false, message: "Comment not found or invalid fields." });
  }

  return res.status(200).json({
    success: true,
    message: "Comment updated successfully.",
    comment: updated,
  });
});

/**
 * PATCH /api/admin/comments/:id
 * Partial update / moderation
 */
router.patch("/:id", (req, res) => {
  const updated = commentsStore.patch(req.params.id, {
    ...req.body,
    moderatedBy: asString(req.body?.moderatedBy),
  });

  if (!updated) {
    return res.status(404).json({ success: false, message: "Comment not found or invalid fields." });
  }

  return res.status(200).json({
    success: true,
    message: "Comment patched successfully.",
    comment: updated,
  });
});

/**
 * POST /api/admin/comments/:id/flag
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
 * POST /api/admin/comments/bulk/delete
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
 * POST /api/admin/comments/bulk/status
 */
router.post("/bulk/status", (req, res) => {
  const ids = parseIds(req.body?.ids);
  const status = req.body?.status;
  const moderatedBy = asString(req.body?.moderatedBy);

  if (!ids.length || !status) {
    return res.status(400).json({
      success: false,
      message: "ids and status are required.",
    });
  }

  const result = commentsStore.bulkSetStatus(ids, status, moderatedBy);
  if (!result) {
    return res.status(400).json({
      success: false,
      message: "Invalid status.",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Bulk status update complete.",
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