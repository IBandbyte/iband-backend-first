// commentsStore.js
// iBand Backend — In-memory comments store (ESM)
// Goal: NEVER throw for "no data" cases. Always return safe arrays/objects.
// This store is intentionally defensive to prevent 500s on public endpoints.

import crypto from "crypto";

// -------------------- Constants --------------------
export const ALLOWED_COMMENT_STATUSES = Object.freeze([
  "pending",
  "approved",
  "rejected",
]);

export const DEFAULT_COMMENT_STATUS = "pending";

// -------------------- Internal State --------------------
/**
 * @typedef {Object} Comment
 * @property {string} id
 * @property {string} artistId
 * @property {string} author
 * @property {string} text
 * @property {"pending"|"approved"|"rejected"} status
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string|null} moderatedAt
 * @property {string|null} moderatedBy
 */

const _comments = [];

// -------------------- Helpers --------------------
function nowISO() {
  return new Date().toISOString();
}

function safeString(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function normalizeId(v) {
  const s = safeString(v).trim();
  return s;
}

function normalizeArtistId(v) {
  // Always treat artistId as a STRING (important for "1" vs 1).
  const s = safeString(v).trim();
  return s;
}

function sanitizeText(v, maxLen = 1000) {
  const s = safeString(v).trim();
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function isValidStatus(status) {
  return ALLOWED_COMMENT_STATUSES.includes(status);
}

function makeId() {
  // Stable unique IDs without external deps
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneComment(c) {
  return { ...c };
}

function sortNewestFirst(a, b) {
  // ISO strings sort lexicographically, but we’ll be explicit
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

// -------------------- Public API (Store) --------------------
const commentsStore = {
  /**
   * Create a new comment (defaults to "pending")
   * Never throws; returns a result object
   */
  create(input = {}) {
    const artistId = normalizeArtistId(input.artistId);
    const author = sanitizeText(input.author, 80);
    const text = sanitizeText(input.text, 1000);

    const errors = [];

    if (!artistId) errors.push("artistId is required");
    if (!author) errors.push("author is required");
    if (!text) errors.push("text is required");

    if (errors.length) {
      return {
        success: false,
        message: "Validation failed",
        errors,
      };
    }

    const createdAt = nowISO();

    /** @type {Comment} */
    const comment = {
      id: makeId(),
      artistId,
      author,
      text,
      status: DEFAULT_COMMENT_STATUS,
      createdAt,
      updatedAt: createdAt,
      moderatedAt: null,
      moderatedBy: null,
    };

    _comments.push(comment);

    return {
      success: true,
      comment: cloneComment(comment),
    };
  },

  /**
   * List ALL comments (admin)
   * Supports optional filters (status, artistId, search)
   * Never throws.
   */
  listAll(filters = {}) {
    const status = normalizeId(filters.status);
    const artistId = normalizeArtistId(filters.artistId);
    const search = sanitizeText(filters.search, 200).toLowerCase();

    let items = _comments;

    if (status) {
      // If invalid status filter is passed, return empty list (not 500)
      if (!isValidStatus(status)) {
        return { success: true, count: 0, comments: [] };
      }
      items = items.filter((c) => c.status === status);
    }

    if (artistId) {
      items = items.filter((c) => c.artistId === artistId);
    }

    if (search) {
      items = items.filter((c) => {
        return (
          c.author.toLowerCase().includes(search) ||
          c.text.toLowerCase().includes(search) ||
          c.id.toLowerCase().includes(search)
        );
      });
    }

    const out = items.slice().sort(sortNewestFirst).map(cloneComment);

    return {
      success: true,
      count: out.length,
      comments: out,
    };
  },

  /**
   * Public endpoint: get comments by artist (ONLY approved)
   * IMPORTANT: if artist has no comments, returns empty list (not 500)
   */
  getByArtist(artistIdInput) {
    const artistId = normalizeArtistId(artistIdInput);

    if (!artistId) {
      // Treat missing artistId as empty, not error, to prevent accidental 500s
      return { success: true, count: 0, comments: [] };
    }

    const out = _comments
      .filter((c) => c.artistId === artistId && c.status === "approved")
      .slice()
      .sort(sortNewestFirst)
      .map(cloneComment);

    return {
      success: true,
      count: out.length,
      comments: out,
    };
  },

  /**
   * Find a comment by id (admin or internal)
   */
  findById(idInput) {
    const id = normalizeId(idInput);
    if (!id) return { success: true, comment: null };

    const found = _comments.find((c) => c.id === id) || null;

    return {
      success: true,
      comment: found ? cloneComment(found) : null,
    };
  },

  /**
   * Update status for ONE comment
   * Never throws.
   */
  setStatus(idInput, statusInput, moderatedByInput = null) {
    const id = normalizeId(idInput);
    const status = normalizeId(statusInput);
    const moderatedBy = moderatedByInput ? sanitizeText(moderatedByInput, 80) : null;

    if (!id) {
      return { success: false, message: "id is required" };
    }
    if (!isValidStatus(status)) {
      return {
        success: false,
        message: `Invalid status. Allowed: ${ALLOWED_COMMENT_STATUSES.join(", ")}`,
      };
    }

    const idx = _comments.findIndex((c) => c.id === id);

    if (idx === -1) {
      return { success: false, message: "Comment not found", id };
    }

    const now = nowISO();
    _comments[idx] = {
      ..._comments[idx],
      status,
      updatedAt: now,
      moderatedAt: now,
      moderatedBy: moderatedBy || _comments[idx].moderatedBy || null,
    };

    return {
      success: true,
      status,
      comment: cloneComment(_comments[idx]),
    };
  },

  /**
   * Bulk update statuses (admin bulk approve/reject)
   * Returns updatedCount and arrays for clarity. Never throws.
   */
  setStatusBulk(idsInput, statusInput, moderatedByInput = null) {
    const status = normalizeId(statusInput);
    const moderatedBy = moderatedByInput ? sanitizeText(moderatedByInput, 80) : null;

    const ids = Array.isArray(idsInput)
      ? idsInput.map(normalizeId).filter(Boolean)
      : [];

    if (!ids.length) {
      return { success: false, message: "ids[] is required" };
    }
    if (!isValidStatus(status)) {
      return {
        success: false,
        message: `Invalid status. Allowed: ${ALLOWED_COMMENT_STATUSES.join(", ")}`,
      };
    }

    const now = nowISO();
    const updatedIds = [];
    const notFoundIds = [];

    for (const id of ids) {
      const idx = _comments.findIndex((c) => c.id === id);
      if (idx === -1) {
        notFoundIds.push(id);
        continue;
      }

      _comments[idx] = {
        ..._comments[idx],
        status,
        updatedAt: now,
        moderatedAt: now,
        moderatedBy: moderatedBy || _comments[idx].moderatedBy || null,
      };

      updatedIds.push(id);
    }

    return {
      success: true,
      status,
      updatedCount: updatedIds.length,
      updatedIds,
      notFoundCount: notFoundIds.length,
      notFoundIds,
    };
  },

  /**
   * Delete a comment by id (future-proof admin tool)
   * Never throws.
   */
  deleteById(idInput) {
    const id = normalizeId(idInput);
    if (!id) return { success: false, message: "id is required" };

    const idx = _comments.findIndex((c) => c.id === id);
    if (idx === -1) return { success: false, message: "Comment not found", id };

    const [removed] = _comments.splice(idx, 1);

    return { success: true, removed: cloneComment(removed) };
  },

  /**
   * Utility: clear store (useful in dev/tests)
   */
  _dangerouslyClearAll() {
    _comments.length = 0;
    return { success: true };
  },

  /**
   * Utility: expose raw count (debug)
   */
  _count() {
    return _comments.length;
  },

  // -------------------- Backwards-compatible aliases --------------------
  // These protect us if older route files call different method names.
  addComment(input) {
    return this.create(input);
  },
  getCommentsByArtist(artistId) {
    return this.getByArtist(artistId);
  },
  bulkUpdateStatus(ids, status, moderatedBy) {
    return this.setStatusBulk(ids, status, moderatedBy);
  },
};

export default commentsStore;