// commentsStore.js (ESM)
// In-memory comments store used by:
// - comments.js (public)
// - adminComments.js (admin)

function nowISO() {
  return new Date().toISOString();
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

class CommentsStore {
  constructor() {
    this._comments = [];
    this._nextId = 1;
  }

  getAll() {
    return this._comments;
  }

  getById(id) {
    return this._comments.find((c) => c.id === String(id)) || null;
  }

  getByArtistId(artistId) {
    return this._comments.filter((c) => c.artistId === String(artistId));
  }

  create({ artistId, author, text }) {
    if (!isNonEmptyString(String(artistId))) {
      throw new Error("artistId is required");
    }
    if (!isNonEmptyString(author)) {
      throw new Error("author is required");
    }
    if (!isNonEmptyString(text)) {
      throw new Error("text is required");
    }

    const comment = {
      id: String(this._nextId++),
      artistId: String(artistId),
      author: String(author).trim(),
      text: String(text).trim(),
      createdAt: nowISO(),
    };

    this._comments.push(comment);
    return comment;
  }

  update(id, { artistId, author, text }) {
    const comment = this.getById(id);
    if (!comment) return null;

    // Full replace: all 3 required
    if (!isNonEmptyString(String(artistId))) return null;
    if (!isNonEmptyString(author)) return null;
    if (!isNonEmptyString(text)) return null;

    comment.artistId = String(artistId);
    comment.author = String(author).trim();
    comment.text = String(text).trim();
    comment.updatedAt = nowISO();

    return comment;
  }

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

    comment.updatedAt = nowISO();
    return comment;
  }

  remove(id) {
    const idx = this._comments.findIndex((c) => c.id === String(id));
    if (idx === -1) return null;
    const [deleted] = this._comments.splice(idx, 1);
    return deleted;
  }

  reset() {
    const deleted = this._comments.length;
    this._comments = [];
    this._nextId = 1;
    return deleted;
  }

  seed() {
    // Safe optional seeding for demos/testing
    const before = this._comments.length;

    const demo = [
      {
        artistId: "1",
        author: "Fan One",
        text: "This track is fire 🔥",
      },
      {
        artistId: "1",
        author: "Fan Two",
        text: "Vote incoming — keep going!",
      },
      {
        artistId: "2",
        author: "Captain Sex",
        text: "Backend is sexy. Comments are live.",
      },
    ];

    for (const d of demo) this.create(d);

    return this._comments.length - before;
  }
}

const commentsStore = new CommentsStore();
export default commentsStore;