// commentsStore.js
// In-memory comment storage (safe + defensive, never throws on empty/unknown cases)

export const ALLOWED_COMMENT_STATUSES = ["pending", "approved", "rejected"];

function nowISO() {
  return new Date().toISOString();
}

function toSafeStringId(value) {
  // We store comment IDs as strings for consistency
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toSafeArtistId(value) {
  // Artist IDs are stored as strings (e.g. "1")
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function isAllowedStatus(status) {
  return ALLOWED_COMMENT_STATUSES.includes(status);
}

let comments = []; // [{ id, artistId, author, text, status, createdAt, updatedAt, moderatedBy, moderatedAt }]

function generateId() {
  // Simple unique-ish id for in-memory use
  return `c_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const commentsStore = {
  reset() {
    comments = [];
    return { success: true };
  },

  create({ artistId, author, text }) {
    const safeArtistId = toSafeArtistId(artistId);
    const safeAuthor = (author ?? "").toString().trim();
    const safeText = (text ?? "").toString().trim();

    if (!safeArtistId) {
      return { success: false, status: 400, message: "artistId is required" };
    }
    if (!safeAuthor) {
      return { success: false, status: 400, message: "author is required" };
    }
    if (!safeText) {
      return { success: false, status: 400, message: "text is required" };
    }

    const newComment = {
      id: generateId(),
      artistId: safeArtistId,
      author: safeAuthor,
      text: safeText,
      status: "pending",
      createdAt: nowISO(),
      updatedAt: nowISO(),
      moderatedBy: null,
      moderatedAt: null,
    };

    comments.unshift(newComment);

    return { success: true, status: 201, comment: newComment };
  },

  getAll({ status } = {}) {
    const safeStatus = (status ?? "").toString().trim();
    if (safeStatus && !isAllowedStatus(safeStatus)) {
      return {
        success: false,
        status: 400,
        message: `Invalid status. Allowed: ${ALLOWED_COMMENT_STATUSES.join(", ")}`,
      };
    }

    const filtered = safeStatus
      ? comments.filter((c) => c.status === safeStatus)
      : [...comments];

    return { success: true, status: 200, comments: filtered };
  },

  getByArtist({ artistId, status } = {}) {
    const safeArtistId = toSafeArtistId(artistId);
    const safeStatus = (status ?? "").toString().trim();

    if (!safeArtistId) {
      return { success: false, status: 400, message: "artistId is required" };
    }
    if (safeStatus && !isAllowedStatus(safeStatus)) {
      return {
        success: false,
        status: 400,
        message: `Invalid status. Allowed: ${ALLOWED_COMMENT_STATUSES.join(", ")}`,
      };
    }

    const filtered = comments.filter((c) => {
      if (c.artistId !== safeArtistId) return false;
      if (safeStatus && c.status !== safeStatus) return false;
      return true;
    });

    // IMPORTANT: Empty arrays are OK, never an error
    return { success: true, status: 200, comments: filtered };
  },

  getApprovedByArtist({ artistId } = {}) {
    // Public endpoint should only show approved, and return [] when none
    return this.getByArtist({ artistId, status: "approved" });
  },

  bulkUpdateStatus({ ids, status, moderatedBy } = {}) {
    const safeStatus = (status ?? "").toString().trim();
    const safeModerator = (moderatedBy ?? "").toString().trim();

    if (!Array.isArray(ids) || ids.length === 0) {
      return { success: false, status: 400, message: "ids must be a non-empty array" };
    }
    if (!isAllowedStatus(safeStatus)) {
      return {
        success: false,
        status: 400,
        message: `Invalid status. Allowed: ${ALLOWED_COMMENT_STATUSES.join(", ")}`,
      };
    }
    if (!safeModerator) {
      return { success: false, status: 400, message: "moderatedBy is required" };
    }

    const idSet = new Set(ids.map(toSafeStringId).filter(Boolean));
    let updatedCount = 0;

    comments = comments.map((c) => {
      if (!idSet.has(toSafeStringId(c.id))) return c;

      updatedCount += 1;
      return {
        ...c,
        status: safeStatus,
        updatedAt: nowISO(),
        moderatedBy: safeModerator,
        moderatedAt: nowISO(),
      };
    });

    return {
      success: true,
      status: 200,
      updatedCount,
      statusSetTo: safeStatus,
      moderatedBy: safeModerator,
    };
  },
};

export default commentsStore;