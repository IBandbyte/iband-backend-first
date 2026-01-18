// commentsStore.js (ESM)
// Single source of truth for comments (Option A - aligned)
// - In-memory (Render-safe)
// - Consistent function names expected by: comments.js + adminComments.js
// - Supports moderation statuses + flags + bulk ops

import crypto from "crypto";

/* -------------------- Helpers -------------------- */

const nowIso = () => new Date().toISOString();

const toStr = (v) => String(v ?? "").trim();

const isNonEmpty = (v) => toStr(v).length > 0;

const makeId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * Status alignment:
 * - Public feed shows: visible, approved  (handled in comments.js)
 * - Admin can set: pending, approved, hidden, visible, rejected
 */
const ALLOWED_STATUSES = ["pending", "approved", "hidden", "visible", "rejected"];

const normalizeStatus = (status) => {
  const s = toStr(status).toLowerCase();
  return ALLOWED_STATUSES.includes(s) ? s : null;
};

const clone = (obj) => JSON.parse(JSON.stringify(obj));

/* -------------------- Store -------------------- */

const commentsStore = {
  ALLOWED_STATUSES,

  // In-memory rows
  comments: [],

  /* ---------- Read ---------- */

  listAll() {
    return [...this.comments].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  },

  // Compatibility alias (adminComments.js uses getAll())
  getAll() {
    return this.listAll();
  },

  getById(id) {
    const cid = toStr(id);
    return this.comments.find((c) => c.id === cid) || null;
  },

  // comments.js expects an ARRAY from getByArtistId()
  getByArtistId(artistId) {
    const aid = toStr(artistId);
    if (!aid) return [];
    return this.comments
      .filter((c) => c.artistId === aid)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  // Optional structured form (if you want it later)
  listByArtist(artistId) {
    const aid = toStr(artistId);
    if (!aid) return { ok: false, status: 400, message: "artistId is required." };

    const rows = this.getByArtistId(aid);
    return { ok: true, artistId: aid, count: rows.length, comments: rows };
  },

  /* ---------- Create ---------- */

  /**
   * Create comment (public/admin)
   * Default status: pending (moderation-friendly)
   */
  create({ artistId, author, text, status } = {}) {
    const aid = toStr(artistId);
    const a = toStr(author);
    const t = toStr(text);

    if (!aid) throw new Error("artistId is required");
    if (!a) throw new Error("author is required");
    if (!t) throw new Error("text is required");

    const s = status ? normalizeStatus(status) : "pending";
    if (!s) throw new Error("Invalid status.");

    const comment = {
      id: makeId(),
      artistId: aid,
      author: a,
      text: t,
      status: s,
      flags: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      moderatedAt: null,
      moderatedBy: null,
      moderationNote: null,
    };

    this.comments.push(comment);
    return clone(comment);
  },

  /* ---------- Update ---------- */

  /**
   * Full update / replace
   * Requires: artistId, author, text
   * Optional: status
   */
  update(id, { artistId, author, text, status } = {}) {
    const existing = this.getById(id);
    if (!existing) return null;

    const aid = toStr(artistId);
    const a = toStr(author);
    const t = toStr(text);

    if (!aid || !a || !t) return null;

    if (status !== undefined) {
      const s = normalizeStatus(status);
      if (!s) return null;
      existing.status = s;
      existing.moderatedAt = nowIso();
    }

    existing.artistId = aid;
    existing.author = a;
    existing.text = t;
    existing.updatedAt = nowIso();

    return clone(existing);
  },

  /**
   * Partial patch
   * Supports: artistId, author, text, status, moderatedBy, moderationNote
   */
  patch(id, patch = {}) {
    const existing = this.getById(id);
    if (!existing) return null;

    if (patch.artistId !== undefined) {
      const aid = toStr(patch.artistId);
      if (!aid) return null;
      existing.artistId = aid;
    }

    if (patch.author !== undefined) {
      const a = toStr(patch.author);
      if (!a) return null;
      existing.author = a;
    }

    if (patch.text !== undefined) {
      const t = toStr(patch.text);
      if (!t) return null;
      existing.text = t;
    }

    if (patch.status !== undefined) {
      const s = normalizeStatus(patch.status);
      if (!s) return null;
      existing.status = s;
      existing.moderatedAt = nowIso();
    }

    if (patch.moderatedBy !== undefined) {
      existing.moderatedBy = toStr(patch.moderatedBy);
      existing.moderatedAt = existing.moderatedAt || nowIso();
    }

    if (patch.moderationNote !== undefined) {
      existing.moderationNote = toStr(patch.moderationNote);
    }

    existing.updatedAt = nowIso();
    return clone(existing);
  },

  /* ---------- Flags ---------- */

  addFlag(id, { code, reason } = {}) {
    const existing = this.getById(id);
    if (!existing) return null;

    const flag = {
      id: makeId(),
      code: toStr(code) || "flag",
      reason: toStr(reason) || "",
      createdAt: nowIso(),
    };

    if (!Array.isArray(existing.flags)) existing.flags = [];
    existing.flags.push(flag);

    existing.updatedAt = nowIso();
    return clone(existing);
  },

  clearFlags(id) {
    const existing = this.getById(id);
    if (!existing) return null;

    existing.flags = [];
    existing.updatedAt = nowIso();
    return clone(existing);
  },

  /* ---------- Bulk Ops ---------- */

  bulkSetStatus(ids = [], status, moderatedBy = "") {
    const s = normalizeStatus(status);
    if (!s) return null;

    const updatedIds = [];
    const notFoundIds = [];

    ids.forEach((rawId) => {
      const id = toStr(rawId);
      const c = this.getById(id);
      if (!c) return notFoundIds.push(id);

      c.status = s;
      c.updatedAt = nowIso();
      c.moderatedAt = nowIso();
      c.moderatedBy = toStr(moderatedBy);

      updatedIds.push(id);
    });

    return { status: s, updatedIds, notFoundIds };
  },

  bulkRemove(ids = []) {
    const deletedIds = [];
    const notFoundIds = [];

    ids.forEach((rawId) => {
      const id = toStr(rawId);
      const idx = this.comments.findIndex((c) => c.id === id);
      if (idx === -1) return notFoundIds.push(id);

      this.comments.splice(idx, 1);
      deletedIds.push(id);
    });

    return { deletedIds, notFoundIds };
  },

  /* ---------- Admin Utilities ---------- */

  reset() {
    const deleted = this.comments.length;
    this.comments = [];
    return deleted;
  },

  seed() {
    // Safe demo seed (does not wipe existing)
    const before = this.comments.length;

    this.comments.push(
      {
        id: makeId(),
        artistId: "demo",
        author: "System",
        text: "Welcome to iBand comments (demo).",
        status: "approved",
        flags: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
        moderatedAt: nowIso(),
        moderatedBy: "seed",
        moderationNote: null,
      },
      {
        id: makeId(),
        artistId: "demo",
        author: "Fan",
        text: "🔥 This artist is going places.",
        status: "visible",
        flags: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
        moderatedAt: null,
        moderatedBy: null,
        moderationNote: null,
      }
    );

    return this.comments.length - before;
  },
};

export default commentsStore;