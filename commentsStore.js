// commentsStore.js
// In-memory comment engine for iBand (public + admin)

let comments = [];
let nextId = 1;

/**
 * Normalize IDs so "1" and 1 behave the same.
 */
function normalizeId(id) {
  return String(id).trim();
}

/**
 * Return a shallow copy of all non-deleted comments.
 */
function getAllComments() {
  return comments.filter((c) => !c.deleted).map((c) => ({ ...c }));
}

/**
 * Return all comments for a given artist (non-deleted).
 */
function getCommentsByArtist(artistId) {
  const targetId = normalizeId(artistId);
  return comments
    .filter((c) => !c.deleted && normalizeId(c.artistId) === targetId)
    .map((c) => ({ ...c }));
}

/**
 * Find a single comment by ID (non-deleted).
 */
function getCommentById(id) {
  const targetId = normalizeId(id);
  const found = comments.find(
    (c) => !c.deleted && normalizeId(c.id) === targetId
  );
  return found ? { ...found } : null;
}

/**
 * Create a new comment.
 * Expects: { artistId, author, text }
 */
function createComment({ artistId, author, text }) {
  const now = new Date().toISOString();

  const comment = {
    id: String(nextId++),
    artistId: normalizeId(artistId),
    author: author && String(author).trim() ? String(author).trim() : "Anonymous",
    text: String(text).trim(),
    createdAt: now,
    updatedAt: now,
    deleted: false,
  };

  comments.push(comment);
  return { ...comment };
}

/**
 * Update a comment (for future use / admin tools).
 * Only allows author + text to change.
 */
function updateComment(id, { author, text }) {
  const targetId = normalizeId(id);
  const idx = comments.findIndex(
    (c) => !c.deleted && normalizeId(c.id) === targetId
  );

  if (idx === -1) return null;

  if (typeof author === "string" && author.trim()) {
    comments[idx].author = author.trim();
  }
  if (typeof text === "string" && text.trim()) {
    comments[idx].text = text.trim();
  }
  comments[idx].updatedAt = new Date().toISOString();

  return { ...comments[idx] };
}

/**
 * Soft-delete a single comment by ID.
 */
function deleteComment(id) {
  const targetId = normalizeId(id);
  const idx = comments.findIndex(
    (c) => !c.deleted && normalizeId(c.id) === targetId
  );

  if (idx === -1) return { deleted: 0 };

  comments[idx].deleted = true;
  comments[idx].updatedAt = new Date().toISOString();

  return { deleted: 1 };
}

/**
 * Soft-delete all comments for a given artist.
 */
function deleteCommentsByArtist(artistId) {
  const targetId = normalizeId(artistId);
  let deleted = 0;

  comments.forEach((c) => {
    if (!c.deleted && normalizeId(c.artistId) === targetId) {
      c.deleted = true;
      c.updatedAt = new Date().toISOString();
      deleted += 1;
    }
  });

  return { deleted };
}

/**
 * Fully reset the comments store (admin use).
 */
function resetComments() {
  const deleted = comments.filter((c) => !c.deleted).length;
  comments = [];
  nextId = 1;
  return { deleted };
}

module.exports = {
  getAllComments,
  getCommentsByArtist,
  getCommentById,
  createComment,
  updateComment,
  deleteComment,
  deleteCommentsByArtist,
  resetComments,
};