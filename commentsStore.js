// commentsStore.js
// iBand Backend — In-memory comments store (authoritative)
// ES Module

import crypto from "crypto";

/**
 * Comment shape (canonical)
 * {
 *   id: string,
 *   artistId: string,
 *   author: string,
 *   text: string,
 *   status: "pending" | "approved" | "rejected",
 *   createdAt: string (ISO),
 *   updatedAt: string (ISO),
 *   moderatedBy: string | null,
 *   moderatedAt: string | null
 * }
 */

const STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  // randomUUID exists in modern Node; fallback for safety
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
}

function normalizeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function sanitizeArtistId(artistId) {
  // Always treat IDs as strings to match frontend routing expectations
  const v = normalizeString(artistId);
  return v;
}

function isValidStatus(status) {
  return status === STATUS.PENDING || status === STATUS.APPROVED || status === STATUS.REJECTED;
}

// Single in-memory source of truth for this running instance
// (Render restarts reset memory — expected for Phase 1/2)
const state = {
  comments: [],
};

// ---------- Core getters ----------
export function getAllComments() {
  // Always return an array (never undefined)
  return Array.isArray(state.comments) ? state.comments : [];
}

export function getCommentById(id) {
  const safeId = normalizeString(id);
  if (!safeId) return null;
  return getAllComments().find((c) => c.id === safeId) || null;
}

// ---------- Public-facing retrieval ----------
export function getApprovedCommentsByArtist(artistId) {
  const aId = sanitizeArtistId(artistId);
  if (!aId) return [];

  return getAllComments()
    .filter((c) => c.artistId === aId && c.status === STATUS.APPROVED)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// Optional helper if you ever need “all statuses by artist”
export function getAllCommentsByArtist(artistId) {
  const aId = sanitizeArtistId(artistId);
  if (!aId) return [];

  return getAllComments()
    .filter((c) => c.artistId === aId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ---------- Admin-facing retrieval ----------
export function adminListComments({ status } = {}) {
  const s = normalizeString(status);
  const list = getAllComments();

  if (!s) {
    // default admin list is everything
    return list
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  if (!isValidStatus(s)) return [];

  return list
    .filter((c) => c.status === s)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ---------- Create ----------
export function createComment({ artistId, author, text }) {
  const aId = sanitizeArtistId(artistId);
  const a = normalizeString(author);
  const t = normalizeString(text);

  // Hard validation — prevents “empty approved comments” and junk
  if (!aId) {
    return {
      ok: false,
      error: "artistId is required",
      statusCode: 400,
    };
  }

  if (!a) {
    return {
      ok: false,
      error: "author is required",
      statusCode: 400,
    };
  }

  if (!t) {
    return {
      ok: false,
      error: "text is required",
      statusCode: 400,
    };
  }

  const ts = nowIso();

  const newComment = {
    id: makeId(),
    artistId: aId,
    author: a,
    text: t,
    status: STATUS.PENDING, // default: pending moderation
    createdAt: ts,
    updatedAt: ts,
    moderatedBy: null,
    moderatedAt: null,
  };

  state.comments = getAllComments();
  state.comments.push(newComment);

  return {
    ok: true,
    comment: newComment,
  };
}

// ---------- Moderation ----------
export function setCommentStatus({ id, status, moderatedBy }) {
  const safeId = normalizeString(id);
  const s = normalizeString(status);
  const modBy = normalizeString(moderatedBy) || "admin";

  if (!safeId) {
    return { ok: false, error: "id is required", statusCode: 400 };
  }
  if (!isValidStatus(s)) {
    return { ok: false, error: "status must be pending|approved|rejected", statusCode: 400 };
  }

  const existing = getCommentById(safeId);
  if (!existing) {
    return { ok: false, error: "comment not found", statusCode: 404 };
  }

  // Prevent “approved empty comment” even if a bad record exists
  if (s === STATUS.APPROVED) {
    const cleanedText = normalizeString(existing.text);
    const cleanedAuthor = normalizeString(existing.author);
    const cleanedArtistId = normalizeString(existing.artistId);

    if (!cleanedText || !cleanedAuthor || !cleanedArtistId) {
      return {
        ok: false,
        error: "cannot approve an empty/invalid comment",
        statusCode: 400,
      };
    }
  }

  const ts = nowIso();

  existing.status = s;
  existing.updatedAt = ts;
  existing.moderatedBy = modBy;
  existing.moderatedAt = ts;

  return { ok: true, comment: existing };
}

export function bulkSetCommentStatus({ ids, status, moderatedBy }) {
  const list = Array.isArray(ids) ? ids.map(normalizeString).filter(Boolean) : [];
  const s = normalizeString(status);
  const modBy = normalizeString(moderatedBy) || "admin";

  if (list.length === 0) {
    return { ok: false, error: "ids must be a non-empty array", statusCode: 400 };
  }
  if (!isValidStatus(s)) {
    return { ok: false, error: "status must be pending|approved|rejected", statusCode: 400 };
  }

  const updatedIds = [];
  const skipped = [];

  for (const id of list) {
    const res = setCommentStatus({ id, status: s, moderatedBy: modBy });
    if (res.ok) updatedIds.push(id);
    else skipped.push({ id, reason: res.error });
  }

  return {
    ok: true,
    status: s,
    updatedCount: updatedIds.length,
    updatedIds,
    skippedCount: skipped.length,
    skipped,
  };
}

// ---------- Utilities (optional for future testing/admin tools) ----------
export function deleteCommentById(id) {
  const safeId = normalizeString(id);
  if (!safeId) return { ok: false, error: "id is required", statusCode: 400 };

  const before = getAllComments().length;
  state.comments = getAllComments().filter((c) => c.id !== safeId);
  const after = state.comments.length;

  if (after === before) return { ok: false, error: "comment not found", statusCode: 404 };
  return { ok: true };
}

export function clearAllComments() {
  state.comments = [];
  return { ok: true };
}

export { STATUS as COMMENT_STATUS };