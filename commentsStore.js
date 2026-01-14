// commentsStore.js
// In-memory comment store (Phase 2 hardened):
// - Never throws for "no results" cases
// - Always returns arrays (even empty)
// - Central source of truth for status validation

export const ALLOWED_COMMENT_STATUSES = ["pending", "approved", "rejected"];

const nowIso = () => new Date().toISOString();

const normalizeId = (val) => String(val ?? "").trim();

class CommentsStore {
  constructor() {
    /** @type {Array<{
     *  id: string,
     *  artistId: string,
     *  author: string,
     *  text: string,
     *  status: "pending"|"approved"|"rejected",
     *  createdAt: string,
     *  moderatedAt?: string,
     *  moderatedBy?: string
     * }>} */
    this.comments = [];
    this.nextId = 1;
  }

  isValidStatus(status) {
    return ALLOWED_COMMENT_STATUSES.includes(status);
  }

  /**
   * Creates a new comment (defaults to pending)
   */
  create({ artistId, author, text }) {
    const aId = normalizeId(artistId);
    const a = String(author ?? "").trim();
    const t = String(text ?? "").trim();

    if (!aId) {
      return { ok: false, error: "artistId is required" };
    }
    if (!a) {
      return { ok: false, error: "author is required" };
    }
    if (!t) {
      return { ok: false, error: "text is required" };
    }

    const id = String(this.nextId++);
    const comment = {
      id,
      artistId: aId,
      author: a,
      text: t,
      status: "pending",
      createdAt: nowIso(),
    };

    this.comments.unshift(comment);
    return { ok: true, comment };
  }

  /**
   * Returns all comments (optionally filtered)
   * Always returns an array (possibly empty)
   */
  list({ artistId, status } = {}) {
    const aId = artistId ? normalizeId(artistId) : null;

    let result = this.comments;

    if (aId) result = result.filter((c) => c.artistId === aId);
    if (status) result = result.filter((c) => c.status === status);

    // Always safe:
    return Array.isArray(result) ? result : [];
  }

  /**
   * Public-safe: only approved comments by artistId.
   * Never throws. Returns [] if none exist.
   */
  listApprovedByArtist(artistId) {
    const aId = normalizeId(artistId);
    if (!aId) return [];
    return this.list({ artistId: aId, status: "approved" });
  }

  /**
   * Admin bulk update comment status
   */
  bulkUpdateStatus({ ids, status, moderatedBy }) {
    const safeIds = Array.isArray(ids)
      ? ids.map(normalizeId).filter(Boolean)
      : [];

    const st = String(status ?? "").trim();
    const modBy = String(moderatedBy ?? "").trim();

    if (!safeIds.length) {
      return { ok: false, error: "ids must be a non-empty array of strings" };
    }
    if (!this.isValidStatus(st)) {
      return { ok: false, error: `Invalid status value: ${st}` };
    }
    if (!modBy) {
      return { ok: false, error: "moderatedBy is required" };
    }

    const updated = [];
    const notFound = [];

    for (const id of safeIds) {
      const idx = this.comments.findIndex((c) => c.id === id);
      if (idx === -1) {
        notFound.push(id);
        continue;
      }

      const existing = this.comments[idx];
      const next = {
        ...existing,
        status: st,
        moderatedBy: modBy,
        moderatedAt: nowIso(),
      };

      this.comments[idx] = next;
      updated.push(next);
    }

    return {
      ok: true,
      status: st,
      updatedCount: updated.length,
      notFound,
      updated,
    };
  }
}

const commentsStore = new CommentsStore();
export default commentsStore;