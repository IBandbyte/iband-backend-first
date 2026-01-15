// commentsStore.js
// In-memory comment store (Phase 1/2)
// ES Module — Render-safe, Node 18–21 compatible

import crypto from "crypto";

const ALLOWED_COMMENT_STATUSES = ["pending", "approved", "rejected"];

const normalizeStatus = (status) => {
  const s = String(status || "").trim().toLowerCase();
  return ALLOWED_COMMENT_STATUSES.includes(s) ? s : null;
};

const nowIso = () => new Date().toISOString();
const toStr = (v) => String(v ?? "").trim();
const isPositiveIntString = (v) => /^\d+$/.test(String(v));

const makeId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const commentsStore = {
  ALLOWED_COMMENT_STATUSES,

  comments: [],

  listAll() {
    return [...this.comments].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  },

  getById(id) {
    return this.comments.find((c) => c.id === toStr(id)) || null;
  },

  create({ artistId, author, text }) {
    if (!isPositiveIntString(artistId))
      return { ok: false, status: 400, message: "artistId must be numeric." };

    if (!toStr(author))
      return { ok: false, status: 400, message: "author is required." };

    if (!toStr(text))
      return { ok: false, status: 400, message: "text is required." };

    const comment = {
      id: makeId(),
      artistId: toStr(artistId),
      author: toStr(author),
      text: toStr(text),
      status: "pending",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      moderatedAt: null,
      moderatedBy: null,
      moderationNote: null,
    };

    this.comments.push(comment);
    return { ok: true, comment };
  },

  listByArtist(artistId, { onlyApproved = true } = {}) {
    if (!isPositiveIntString(artistId))
      return { ok: false, status: 400, message: "Invalid artistId." };

    const rows = this.comments.filter(
      (c) =>
        c.artistId === toStr(artistId) &&
        (!onlyApproved || c.status === "approved")
    );

    return {
      ok: true,
      artistId: toStr(artistId),
      count: rows.length,
      comments: rows.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      ),
    };
  },

  listAdmin({ status, artistId } = {}) {
    let rows = this.listAll();

    if (status) {
      const s = normalizeStatus(status);
      if (!s)
        return {
          ok: false,
          status: 400,
          message: `Allowed: ${ALLOWED_COMMENT_STATUSES.join(", ")}`,
        };
      rows = rows.filter((c) => c.status === s);
    }

    if (artistId) {
      if (!isPositiveIntString(artistId))
        return { ok: false, status: 400, message: "Invalid artistId." };
      rows = rows.filter((c) => c.artistId === toStr(artistId));
    }

    return { ok: true, count: rows.length, comments: rows };
  },

  bulkUpdateStatus({ ids, status, moderatedBy, moderationNote }) {
    const s = normalizeStatus(status);
    if (!s)
      return {
        ok: false,
        status: 400,
        message: `Allowed: ${ALLOWED_COMMENT_STATUSES.join(", ")}`,
      };

    let updated = 0;
    const missing = [];

    ids.forEach((id) => {
      const c = this.getById(id);
      if (!c) return missing.push(id);

      c.status = s;
      c.updatedAt = nowIso();
      c.moderatedAt = nowIso();
      c.moderatedBy = toStr(moderatedBy);
      c.moderationNote = toStr(moderationNote);
      updated++;
    });

    return { ok: true, status: s, updated, missing };
  },
};

export default commentsStore;