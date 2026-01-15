// adminComments.js
// Admin comments router (ESM)
// - GET  /api/admin/comments?status=pending|approved|rejected&artistId=1&q=text&limit=200&offset=0
// - POST /api/admin/comments/bulk-status
//
// IMPORTANT:
// We intentionally do NOT import named exports from commentsStore.js,
// because Render deploys can crash if a named export goes missing.
// This file is resilient even if commentsStore.js changes.

import express from "express";
import commentsStore from "./commentsStore.js";

const router = express.Router();

// Safe fallback list (matches store design)
const ALLOWED_STATUSES_FALLBACK = ["pending", "approved", "rejected"];

function getAllowedStatuses() {
  // If store exposes it in the future, use it; otherwise fallback
  const maybe = commentsStore?.ALLOWED_COMMENT_STATUSES;
  if (Array.isArray(maybe) && maybe.length) return maybe;
  return ALLOWED_STATUSES_FALLBACK;
}

function normalizeStatus(status) {
  const s = String(status || "").trim().toLowerCase();
  const allowed = getAllowedStatuses();
  return allowed.includes(s) ? s : null;
}

// --------------------
// GET /api/admin/comments
// Query: status, artistId, q, limit, offset
// --------------------
router.get("/comments", (req, res) => {
  try {
    const statusRaw = req.query.status ?? null;
    const artistId = req.query.artistId ?? null;
    const q = req.query.q ?? null;
    const limit = req.query.limit ?? 200;
    const offset = req.query.offset ?? 0;

    // Validate status if provided
    let status = null;
    if (statusRaw !== null && String(statusRaw).trim() !== "") {
      status = normalizeStatus(statusRaw);
      if (!status) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Allowed: ${getAllowedStatuses().join(", ")}`,
          allowedStatuses: getAllowedStatuses(),
        });
      }
    }

    // Your store method is listAdmin()
    const result = commentsStore.listAdmin({
      status,
      artistId,
      q,
      limit,
      offset,
    });

    // listAdmin returns { ok: true/false, ... }
    if (!result?.ok) {
      return res.status(result?.status || 400).json({
        success: false,
        message: result?.message || "Bad request",
        allowedStatuses: getAllowedStatuses(),
      });
    }

    return res.status(200).json({
      success: true,
      count: result.count,
      limit: result.limit,
      offset: result.offset,
      comments: result.comments || [],
      allowedStatuses: getAllowedStatuses(),
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// --------------------
// POST /api/admin/comments/bulk-status
// Body: { ids: [], status: "approved", moderatedBy, moderationNote }
// --------------------
router.post("/comments/bulk-status", (req, res) => {
  try {
    const { ids, status, moderatedBy, moderationNote } = req.body ?? {};

    // Validate status
    const s = normalizeStatus(status);
    if (!s) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed: ${getAllowedStatuses().join(", ")}`,
        allowedStatuses: getAllowedStatuses(),
      });
    }

    const result = commentsStore.bulkUpdateStatus({
      ids,
      status: s,
      moderatedBy,
      moderationNote,
    });

    // bulkUpdateStatus returns { ok: true/false, ... }
    if (!result?.ok) {
      return res.status(result?.status || 400).json({
        success: false,
        message: result?.message || "Bad request",
        allowedStatuses: getAllowedStatuses(),
      });
    }

    return res.status(200).json({
      success: true,
      status: result.status,
      updated: result.updated,
      updatedIds: result.updatedIds,
      missing: result.missing,
      missingIds: result.missingIds,
      allowedStatuses: getAllowedStatuses(),
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;