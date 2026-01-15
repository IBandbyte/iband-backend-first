// commentsStore.js
// In-memory comment store (Phase 1/2)
// ES Module compatible (Render / Node 18+)
// - Future-proofed exports to avoid deploy/import mismatches

import crypto from "crypto";

/**
 * Named export REQUIRED by:
 * - comments.js
 * - adminComments.js
 */
export const ALLOWED_COMMENT_STATUSES = ["pending", "approved", "rejected"];
export const ALLOWED_COMMENT_STATUSES_SET = new Set(ALLOWED_COMMENT_STATUSES);

export function normalizeStatus(status) {
  const s = String(status || "").trim().toLowerCase();
  return ALLOWED_COMMENT_STATUSES_SET.has(s) ? s : null;
}

const nowIso = () => new Date().toISOString();
const toStr = (v) => String(v ?? "").trim();
const isPositiveIntString = (v) => /^\d+$/.test(String(v));

const makeId = () => {
  // Node 18+ supports randomUUID in crypto
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

// Internal version marker to confirm Render is running the latest code
const STORE_VERSION = "commentsStore-v3-2026-01-15";

const store = {
  comments: [],

  // -------- Meta (debug / sanity) --------
  __meta() {
    return {
      ok: true,
      store: "commentsStore",
      version: STORE_VERSION,
      allowedStatuses: [...ALLOWED_COMMENT_STATUSES],
      count: this.comments.length,
      timestamp: nowIso(),
    };
  },

  // -------- Core helpers --------
  listAll() {
    return [...this.comments].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  getById(id) {
    const key = toStr(id);
    if (!key) return null;
    return this.comments.find((c) => c.id === key) || null;
  },

  // -------- Create --------
  create({ artistId, author, text }) {
    const aId = toStr(artistId);
    const a = toStr(author);
    const t = toStr(text);

    if (!isPositiveIntString(aId)) {
      return {
        ok: false,
        status: 400,
        message: "artistId must be a positive integer string.",
      };
    }

    if (!a) {
      return { ok: false, status: 400, message: "author is required." };
    }

    if (!t) {
      return { ok: false, status: 400, message: "text is required." };
    }

    const ts = nowIso();

    const comment = {
      id: makeId(),
      artistId: aId,
      author: a,
      text: t,
      status: "pending",
      createdAt: ts,
      updatedAt: ts,
      moderatedAt: null,
      moderatedBy: null,
      moderationNote: null,
    };

    this.comments.push(comment);

    return { ok: true, comment };
  },

  // -------- Public query --------
  listByArtist(artistId, { onlyApproved = true } = {}) {
    const aId = toStr(artistId);

    if (!isPositiveIntString(aId)) {
      return {
        ok: false,
        status: 400,
        message: "artistId must be a positive integer string.",
      };
    }

    const filtered = this.comments.filter((c) => c.artistId === aId);

    const visible = onlyApproved
      ? filtered.filter((c) => c.status === "approved")
      : filtered;

    return {
      ok: true,
      artistId: aId,
      count: visible.length,
      comments: [...visible].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    };
  },

  // -------- Admin query --------
  listAdmin({
    status = null,
    artistId = null,
    q = null,
    limit = 200,
    offset = 0,
  } = {}) {
    let rows = this.listAll();

    const s = status ? normalizeStatus(status) : null;
    if (status && !s) {
      return {
        ok: false,
        status: 400,
        message: `Invalid status. Allowed: ${ALLOWED_COMMENT_STATUSES.join(", ")}`,
      };
    }

    if (s) rows = rows.filter((c) => c.status === s);

    if (artistId != null) {
      const aId = toStr(artistId);
      if (!isPositiveIntString(aId)) {
        return {
          ok: false,
          status: 400,
          message: "artistId filter must be a positive integer string.",
        };
      }
      rows = rows.filter((c) => c.artistId === aId);
    }

    if (q) {
      const needle = toStr(q).toLowerCase();
      if (needle) {
        rows = rows.filter((c) => {
          return (
            String(c.author || "").toLowerCase().includes(needle) ||
            String(c.text || "").toLowerCase().includes(needle) ||
            String(c.artistId || "").toLowerCase().includes(needle) ||
            String(c.status || "").toLowerCase().includes(needle) ||
            String(c.id || "").toLowerCase().includes(needle)
          );
        });
      }
    }

    const safeLimit = Math.max(1, Math.min(Number(limit) || 200, 500));
    const safeOffset = Math.max(0, Number(offset) || 0);

    const page = rows.slice(safeOffset, safeOffset + safeLimit);

    return {
      ok: true,
      count: rows.length,
      limit: safeLimit,
      offset: safeOffset,
      comments: page,
    };
  },

  // -------- Moderation --------
  bulkUpdateStatus({ ids, status, moderatedBy = null, moderationNote = null }) {
    const s = normalizeStatus(status);
    if (!s) {
      return {
        ok: false,
        status: 400,
        message: `Invalid status. Allowed: ${ALLOWED_COMMENT_STATUSES.join(", ")}`,
      };
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return {
        ok: false,
        status: 400,
        message: "ids must be a non-empty array.",
      };
    }

    const by = moderatedBy ? toStr(moderatedBy) : null;
    const note = moderationNote ? toStr(moderationNote) : null;

    const uniqueIds = [...new Set(ids.map((x) => toStr(x)).filter(Boolean))];

    let updated = 0;
    const updatedIds = [];
    const missingIds = [];

    for (const id of uniqueIds) {
      const c = this.getById(id);
      if (!c) {
        missingIds.push(id);
        continue;
      }

      const ts = nowIso();
      c.status = s;
      c.updatedAt = ts;
      c.moderatedAt = ts;
      c.moderatedBy = by;
      c.moderationNote = note;

      updated += 1;
      updatedIds.push(id);
    }

    return {
      ok: true,
      status: s,
      updated,
      updatedIds,
      missing: missingIds.length,
      missingIds,
    };
  },
};

const commentsStore = store;
export default commentsStore;