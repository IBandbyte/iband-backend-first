// commentsStore.js (ESM)
// In-memory store for comments with moderation status support.
// Option B: keep "rejected" stored (hidden from public), visible to admin.

const ALLOWED_STATUSES = new Set(["pending", "approved", "rejected"]);

function nowIso() {
  return new Date().toISOString();
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeId(v) {
  // We store IDs as strings for consistency across Hoppscotch usage.
  return String(v);
}

function validateStatus(status) {
  if (!isNonEmptyString(status)) return { ok: false, message: "status is required" };
  const normalized = status.trim().toLowerCase();
  if (!ALLOWED_STATUSES.has(normalized)) {
    return {
      ok: false,
      message: `Invalid status value. Allowed: ${Array.from(ALLOWED_STATUSES).join(", ")}`
    };
  }
  return { ok: true, value: normalized };
}

const state = {
  nextId: 1,
  comments: []
};

function create({ artistId, author, text }) {
  if (!isNonEmptyString(artistId)) {
    return { ok: false, status: 400, error: "artistId is required" };
  }
  if (!isNonEmptyString(author)) {
    return { ok: false, status: 400, error: "author is required" };
  }
  if (!isNonEmptyString(text)) {
    return { ok: false, status: 400, error: "text is required" };
  }

  const comment = {
    id: normalizeId(state.nextId++),
    artistId: normalizeId(artistId),
    author: author.trim(),
    text: text.trim(),
    status: "pending",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    moderatedBy: null,
    moderatedAt: null
  };

  state.comments.unshift(comment); // newest first
  return { ok: true, status: 201, comment };
}

function listAll({ status } = {}) {
  // Admin view. Optionally filter by status.
  if (status === undefined || status === null || status === "") {
    return { ok: true, status: 200, comments: [...state.comments] };
  }

  const v = validateStatus(status);
  if (!v.ok) return { ok: false, status: 400, error: v.message };

  const filtered = state.comments.filter((c) => c.status === v.value);
  return { ok: true, status: 200, comments: filtered };
}

function listByArtist({ artistId, status } = {}) {
  // Admin view for a specific artist. Optionally filter by status.
  if (!isNonEmptyString(artistId)) {
    return { ok: false, status: 400, error: "artistId is required" };
  }

  const id = normalizeId(artistId);
  let results = state.comments.filter((c) => c.artistId === id);

  if (status !== undefined && status !== null && status !== "") {
    const v = validateStatus(status);
    if (!v.ok) return { ok: false, status: 400, error: v.message };
    results = results.filter((c) => c.status === v.value);
  }

  return { ok: true, status: 200, comments: results };
}

function listPublicByArtist({ artistId } = {}) {
  // Public view MUST only show approved comments (Option B).
  if (!isNonEmptyString(artistId)) {
    return { ok: false, status: 400, error: "artistId is required" };
  }

  const id = normalizeId(artistId);
  const results = state.comments.filter((c) => c.artistId === id && c.status === "approved");
  return { ok: true, status: 200, comments: results };
}

function getById(id) {
  const cid = normalizeId(id);
  return state.comments.find((c) => c.id === cid) || null;
}

function updateStatus({ id, status, moderatedBy } = {}) {
  if (!isNonEmptyString(id)) return { ok: false, status: 400, error: "id is required" };

  const v = validateStatus(status);
  if (!v.ok) return { ok: false, status: 400, error: v.message };

  const comment = getById(id);
  if (!comment) return { ok: false, status: 404, error: "Comment not found" };

  comment.status = v.value;
  comment.moderatedBy = isNonEmptyString(moderatedBy) ? moderatedBy.trim() : comment.moderatedBy;
  comment.moderatedAt = nowIso();
  comment.updatedAt = nowIso();

  return { ok: true, status: 200, comment };
}

function bulkUpdateStatus({ ids, status, moderatedBy } = {}) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, status: 400, error: "ids is required (non-empty array)" };
  }

  const v = validateStatus(status);
  if (!v.ok) return { ok: false, status: 400, error: v.message };

  const normalizedIds = ids.map(normalizeId);
  const updated = [];
  const notFound = [];

  for (const id of normalizedIds) {
    const comment = getById(id);
    if (!comment) {
      notFound.push(id);
      continue;
    }
    comment.status = v.value;
    comment.moderatedBy = isNonEmptyString(moderatedBy) ? moderatedBy.trim() : comment.moderatedBy;
    comment.moderatedAt = nowIso();
    comment.updatedAt = nowIso();
    updated.push(comment);
  }

  return {
    ok: true,
    status: 200,
    result: {
      status: v.value,
      updatedCount: updated.length,
      updatedIds: updated.map((c) => c.id),
      notFoundCount: notFound.length,
      notFoundIds: notFound
    }
  };
}

function reset() {
  state.nextId = 1;
  state.comments = [];
  return { ok: true, status: 200 };
}

export const commentsStore = {
  ALLOWED_STATUSES: Array.from(ALLOWED_STATUSES),
  create,
  listAll,
  listByArtist,
  listPublicByArtist,
  getById,
  updateStatus,
  bulkUpdateStatus,
  reset
};

export default commentsStore;