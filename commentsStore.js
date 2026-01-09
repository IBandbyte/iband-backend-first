// CommentsStore.js (ESM)
// Single source of truth for ALL comments (public + admin)

class CommentsStore {
  constructor() {
    this.comments = [];
    this.nextId = 1;
  }

  create({ artistId, author, text }) {
    if (!artistId) throw new Error("artistId is required");
    if (!text || typeof text !== "string" || !text.trim()) {
      throw new Error("text is required");
    }

    const comment = {
      id: String(this.nextId++),
      artistId: String(artistId),
      author: author && String(author).trim() ? String(author).trim() : "Anonymous",
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    this.comments.push(comment);
    return comment;
  }

  getAll() {
    return this.comments;
  }

  getByArtist(artistId) {
    return this.comments.filter((c) => c.artistId === String(artistId));
  }

  getById(id) {
    return this.comments.find((c) => c.id === String(id)) || null;
  }

  update(id, updates = {}) {
    const comment = this.getById(id);
    if (!comment) return null;

    if (updates.author !== undefined) comment.author = updates.author;
    if (updates.text !== undefined) comment.text = updates.text;

    comment.updatedAt = new Date().toISOString();
    return comment;
  }

  delete(id) {
    const index = this.comments.findIndex((c) => c.id === String(id));
    if (index === -1) return false;
    this.comments.splice(index, 1);
    return true;
  }

  deleteByArtist(artistId) {
    const before = this.comments.length;
    this.comments = this.comments.filter((c) => c.artistId !== String(artistId));
    return before - this.comments.length;
  }

  reset() {
    const deleted = this.comments.length;
    this.comments = [];
    this.nextId = 1;
    return deleted;
  }
}

const store = new CommentsStore();
export default store;