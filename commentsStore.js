export const ALLOWED_COMMENT_STATUSES = ["pending", "approved", "rejected"];

// In-memory store (safe + normalized)
const state = {
  comments: [],
  nextId: 1,
};

function nowISO() {
  return new Date().toISOString();
}

function normalize(raw) {
  const createdAt = raw?.createdAt ? String(raw.createdAt) : nowISO();
  const updatedAt = raw?.updatedAt ? String(raw.updatedAt) : createdAt;

  const status = ALLOWED_COMMENT_STATUSES.includes(String(raw?.status))
    ? String(raw.status)
    : "pending";

  return {
    id: raw?.id !== undefined ? String(raw.id) : String(state.nextId++),
    artistId: raw?.artistId !== undefined ? String(raw.artistId) : "0",
    author: raw?.author !== undefined && String(raw.author).trim() ? String(raw.author) : "Anonymous",
    text: raw?.text !== undefined ? String(raw.text) : "",
    status,
    moderatedBy: raw?.moderatedBy !== undefined ? raw.moderatedBy : null,
    createdAt,
    updatedAt,
  };
}

const commentsStore = {
  // Always returns an array, always normalized, never throws.
  getAll() {
    if (!Array.isArray(state.comments)) state.comments = [];
    state.comments = state.comments.map(normalize);
    // newest first
    return [...state.comments].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },

  getByArtistId(artistId) {
    const all = this.getAll();
    return all.filter((c) => String(c.artistId) === String(artistId));
  },

  create({ artistId, author, text }) {
    const comment = normalize({
      id: String(state.nextId++),
      artistId,
      author,
      text,
      status: "pending",
      moderatedBy: null,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    });

    state.comments.unshift(comment);
    return comment;
  },

  findById(id) {
    const all = this.getAll();
    return all.find((c) => String(c.id) === String(id)) || null;
  },

  remove(id) {
    const before = state.comments.length;
    const found = this.findById(id);
    state.comments = state.comments.filter((c) => String(c.id) !== String(id));
    return before !== state.comments.length ? found : null;
  },

  setStatus(id, status, moderatedBy = null) {
    const allowed = ALLOWED_COMMENT_STATUSES.includes(String(status));
    if (!allowed) return { ok: false, reason: "invalid_status" };

    const idx = state.comments.findIndex((c) => String(c.id) === String(id));
    if (idx === -1) return { ok: false, reason: "not_found" };

    const existing = normalize(state.comments[idx]);
    const updated = normalize({
      ...existing,
      status: String(status),
      moderatedBy: moderatedBy ? String(moderatedBy) : existing.moderatedBy,
      updatedAt: nowISO(),
    });

    state.comments[idx] = updated;
    return { ok: true, updated };
  },

  bulkSetStatus(ids, status, moderatedBy = null) {
    const updated = [];
    const notFoundIds = [];

    for (const id of ids) {
      const r = this.setStatus(id, status, moderatedBy);
      if (r.ok) updated.push(r.updated);
      else if (r.reason === "not_found") notFoundIds.push(String(id));
    }

    return { updatedCount: updated.length, notFoundIds, updated };
  },

  reset() {
    state.comments = [];
    state.nextId = 1;
    return true;
  },
};

export default commentsStore;
export { commentsStore };