// commentsStore.js (ESM)
// In-memory comments store used by:
// - comments.js (public)
// - adminComments.js (admin)
//
// Option A upgrades:
// - moderation fields (status, flags, moderation info)
// - bulk delete
// - bulk moderation actions

function nowISO() {
  return new Date().toISOString();
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeStatus(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "visible" || s === "hidden" || s === "approved" || s === "pending") return s;
  return null;
}

class CommentsStore {
  constructor() {
    this._comments = [];
    this._nextId = 1;
  }

  // ---------- reads ----------
  getAll() {
    return this._comments;
  }

  getById(id) {
    return this._comments.find((c) => c.id === String(id)) || null;
  }

  getByArtistId(artistId) {
    return this._comments.filter((c) => c.artistId === String(artistId));
  }

  // ---------- create ----------
  create({ artistId, author, text }) {
    if (!isNonEmptyString(String(artistId))) throw new Error("artistId is required");
    if (!isNonEmptyString(author)) throw new Error("author is required");
    if (!isNonEmptyString(text)) throw new Error("text is required");

    const comment = {
      id: String(this._nextId++),
      artistId: String(artistId),
      author: String(author).trim(),
      text: String(text).trim(),

      // Moderation (Option A)
      status: "visible", // visible | hidden | approved | pending
      flags: [], // array of { code, reason, at }
      moderatedAt: null,
      moderatedBy: null,

      createdAt: nowISO(),
      updatedAt: null,
    };

    this._comments.push(comment);
    return comment;
  }

  // ---------- update (full replace) ----------
  update(id, { artistId, author, text, status }) {
    const comment = this.getById(id);
    if (!comment) return null;

    if (!isNonEmptyString(String(artistId))) return null;
    if (!isNonEmptyString(author)) return null;
    if (!isNonEmptyString(text)) return null;

    comment.artistId = String(artistId);
    comment.author = String(author).trim();
    comment.text = String(text).trim();

    if (status !== undefined) {
      const s = normalizeStatus(status);
      if (!s) return null;
      comment.status = s;
      comment.moderatedAt = nowISO();
    }

    comment.updatedAt = nowISO();
    return comment;
  }

  // ---------- patch (partial update + moderation) ----------
  patch(id, partial = {}) {
    const comment = this.getById(id);
    if (!comment) return null;

    if (partial.artistId !== undefined && isNonEmptyString(String(partial.artistId))) {
      comment.artistId = String(partial.artistId);
    }

    if (partial.author !== undefined && isNonEmptyString(partial.author)) {
      comment.author = String(partial.author).trim();
    }

    if (partial.text !== undefined && isNonEmptyString(partial.text)) {
      comment.text = String(partial.text).trim();
    }

    // Moderation fields
    if (partial.status !== undefined) {
      const s = normalizeStatus(partial.status);
      if (!s) return null;
      comment.status = s;
      comment.moderatedAt = nowISO();
      if (partial.moderatedBy !== undefined && isNonEmptyString(partial.moderatedBy)) {
        comment.moderatedBy = String(partial.moderatedBy).trim();
      }
    }

    comment.updatedAt = nowISO();
    return comment;
  }

  // ---------- moderation helpers ----------
  addFlag(id, { code, reason } = {}) {
    const comment = this.getById(id);
    if (!comment) return null;

    const flagCode = isNonEmptyString(code) ? String(code).trim().toLowerCase() : "flag";
    const flagReason = isNonEmptyString(reason) ? String(reason).trim() : "";

    comment.flags.push({
      code: flagCode,
      reason: flagReason,
      at: nowISO(),
    });

    comment.moderatedAt = nowISO();
    comment.updatedAt = nowISO();
    return comment;
  }

  clearFlags(id) {
    const comment = this.getById(id);
    if (!comment) return null;

    comment.flags = [];
    comment.moderatedAt = nowISO();
    comment.updatedAt = nowISO();
    return comment;
  }

  // ---------- delete ----------
  remove(id) {
    const idx = this._comments.findIndex((c) => c.id === String(id));
    if (idx === -1) return null;
    const [deleted] = this._comments.splice(idx, 1);
    return deleted;
  }

  removeByArtistId(artistId) {
    const before = this._comments.length;
    this._comments = this._comments.filter((c) => c.artistId !== String(artistId));
    return before - this._comments.length;
  }

  // ---------- bulk ops (Option A) ----------
  bulkRemove(ids = []) {
    const wanted = new Set((Array.isArray(ids) ? ids : []).map((x) => String(x)));
    const deletedIds = [];
    const notFoundIds = [];

    // Track which existed
    for (const id of wanted) {
      if (!this.getById(id)) notFoundIds.push(id);
    }

    this._comments = this._comments.filter((c) => {
      if (wanted.has(c.id)) {
        deletedIds.push(c.id);
        return false;
      }
      return true;
    });

    return { deletedIds, notFoundIds };
  }

  bulkSetStatus(ids = [], status, moderatedBy) {
    const s = normalizeStatus(status);
    if (!s) return null;

    const wanted = new Set((Array.isArray(ids) ? ids : []).map((x) => String(x)));
    const updatedIds = [];
    const notFoundIds = [];

    for (const id of wanted) {
      const c = this.getById(id);
      if (!c) {
        notFoundIds.push(id);
        continue;
      }
      c.status = s;
      c.moderatedAt = nowISO();
      c.updatedAt = nowISO();
      if (isNonEmptyString(moderatedBy)) c.moderatedBy = String(moderatedBy).trim();
      updatedIds.push(id);
    }

    return { status: s, updatedIds, notFoundIds };
  }

  // ---------- reset / seed ----------
  reset() {
    const deleted = this._comments.length;
    this._comments = [];
    this._nextId = 1;
    return deleted;
  }

  seed() {
    const before = this._comments.length;
    const demo = [
      { artistId: "1", author: "Fan One", text: "This track is fire 🔥" },
      { artistId: "1", author: "Fan Two", text: "Vote incoming — keep going!" },
      { artistId: "2", author: "Captain", text: "Moderation system online." },
    ];
    for (const d of demo) this.create(d);
    return this._comments.length - before;
  }
}

const commentsStore = new CommentsStore();
export default commentsStore;