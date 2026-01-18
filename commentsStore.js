// commentsStore.js (ESM)
// Canonical comment persistence (Phase 1: in-memory, Render-safe)
//
// Canonical statuses (Option A):
// - pending   (created by public, awaiting moderation)
// - approved  (public can see)
// - hidden    (admin hides from public but keeps record)
// - rejected  (spam/abuse)
//
// This store is written to match the routers exactly:
// Used by:
// - comments.js (public)
// - adminComments.js (admin)

import crypto from "crypto";

/* -------------------- Constants -------------------- */

export const ALLOWED_COMMENT_STATUSES = ["pending", "approved", "hidden", "rejected"];

const nowIso = () => new Date().toISOString();

const toStr = (v) => String(v ?? "").trim();

const isNonEmpty = (v) => toStr(v).length > 0;

const normalizeStatus = (status) => {
  const s = String(status ?? "").trim().toLowerCase();
  return ALLOWED_COMMENT_STATUSES.includes(s) ? s : null;
};

const makeId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/* -------------------- Store -------------------- */

const store = {
  ALLOWED_COMMENT_STATUSES,
  comments: [],

  /* ---------- Query ---------- */

  getAll() {
    return [...this.comments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  getById(id) {
    const clean = toStr(id);
    return this.comments.find((c) => c.id === clean) || null;
  },

  getByArtistId(artistId) {
    const aid = toStr(artistId);
    return this.getAll().filter((c) => c.artistId === aid);
  },

  /* ---------- Create ---------- */

  create({ artistId, author, text, status } = {}) {
    const aid = toStr(artistId);
    const a = toStr(author);
    const t = toStr(text);

    if (!isNonEmpty(aid)) {
      throw new Error("artistId is required.");
    }
    if (!isNonEmpty(a)) {
      throw new Error("author is required.");
    }
    if (!isNonEmpty(t)) {
      throw new Error("text is required.");
    }

    const s = status ? normalizeStatus(status) : "pending";
    if (!s) {
      throw new Error(`Invalid status. Allowed: ${ALLOWED_COMMENT_STATUSES.join(", ")}`);
    }

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
    return comment;
  },

  /* ---------- Update (PUT semantics) ---------- */

  update(id, { artistId, author, text, status, moderatedBy, moderationNote } = {}) {
    const existing = this.getById(id);
    if (!existing) return null;

    const aid = toStr(artistId);
    const a = toStr(author);
    const t = toStr(text);

    if (!isNonEmpty(aid) || !isNonEmpty(a) || !isNonEmpty(t)) return null;

    const nextStatus = status !== undefined ? normalizeStatus(status) : existing.status;
    if (!nextStatus) return null;

    existing.artistId = aid;
    existing.author = a;
    existing.text = t;
    existing.status = nextStatus;

    // moderation fields (optional)
    if (moderatedBy !== undefined) existing.moderatedBy = toStr(moderatedBy);
    if (moderationNote !== undefined) existing.moderationNote = toStr(moderationNote);

    if (status !== undefined || moderatedBy !== undefined || moderationNote !== undefined) {
      existing.moderatedAt = nowIso();
    }

    existing.updatedAt = nowIso();
    return existing;
  },

  /* ---------- Patch (PATCH semantics) ---------- */

  patch(id, patch = {}) {
    const existing = this.getById(id);
    if (!existing) return null;

    if (patch.artistId !== undefined) {
      const aid = toStr(patch.artistId);
      if (!isNonEmpty(aid)) return null;
      existing.artistId = aid;
    }

    if (patch.author !== undefined) {
      const a = toStr(patch.author);
      if (!isNonEmpty(a)) return null;
      existing.author = a;
    }

    if (patch.text !== undefined) {
      const t = toStr(patch.text);
      if (!isNonEmpty(t)) return null;
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
      existing.moderatedAt = nowIso();
    }

    if (patch.moderationNote !== undefined) {
      existing.moderationNote = toStr(patch.moderationNote);
      existing.moderatedAt = nowIso();
    }

    existing.updatedAt = nowIso();
    return existing;
  },

  /* ---------- Flags ---------- */

  addFlag(id, { code, reason } = {}) {
    const existing = this.getById(id);
    if (!existing) return null;

    const flag = {
      code: toStr(code) || "flag",
      reason: toStr(reason) || "",
      at: nowIso(),
    };

    if (!Array.isArray(existing.flags)) existing.flags = [];
    existing.flags.push(flag);

    existing.updatedAt = nowIso();
    return existing;
  },

  clearFlags(id) {
    const existing = this.getById(id);
    if (!existing) return null;

    existing.flags = [];
    existing.updatedAt = nowIso();
    return existing;
  },

  /* ---------- Bulk ops ---------- */

  bulkRemove(ids = []) {
    const list = Array.isArray(ids) ? ids.map(toStr).filter(Boolean) : [];
    const deletedIds = [];
    const notFoundIds = [];

    list.forEach((id) => {
      const idx = this.comments.findIndex((c) => c.id === id);
      if (idx === -1) {
        notFoundIds.push(id);
        return;
      }
      this.comments.splice(idx, 1);
      deletedIds.push(id);
    });

    return { deletedIds, notFoundIds };
  },

  bulkSetStatus(ids = [], status, moderatedBy = "", moderationNote = "") {
    const s = normalizeStatus(status);
    if (!s) return null;

    const list = Array.isArray(ids) ? ids.map(toStr).filter(Boolean) : [];
    const updatedIds = [];
    const notFoundIds = [];

    list.forEach((id) => {
      const c = this.getById(id);
      if (!c) {
        notFoundIds.push(id);
        return;
      }
      c.status = s;
      c.moderatedBy = toStr(moderatedBy);
      c.moderationNote = toStr(moderationNote);
      c.moderatedAt = nowIso();
      c.updatedAt = nowIso();
      updatedIds.push(id);
    });

    return { status: s, updatedIds, notFoundIds };
  },

  /* ---------- Admin utilities ---------- */

  reset() {
    const deleted = this.comments.length;
    this.comments = [];
    return deleted;
  },

  seed() {
    const before = this.comments.length;

    this.create({
      artistId: "demo",
      author: "System",
      text: "Welcome to iBand comments.",
      status: "approved",
    });

    this.create({
      artistId: "demo",
      author: "System",
      text: "This is a pending comment (needs approval).",
      status: "pending",
    });

    return this.comments.length - before;
  },
};

export default store;