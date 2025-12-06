// commentsStore.js
// Central in-memory store + helpers for comments.
// Used by both public comments API and admin comments API.

let comments = [];
let nextCommentId = 1;

function sanitiseComment(comment) {
  return {
    id: String(comment.id),
    artistId: String(comment.artistId),
    author: comment.author,
    text: comment.text,
    createdAt: comment.createdAt,
  };
}

function getAllComments() {
  return comments.map(sanitiseComment);
}

function getCommentsByArtist(artistId) {
  const artistIdStr = String(artistId);
  return comments
    .filter((c) => String(c.artistId) === artistIdStr)
    .map(sanitiseComment);
}

function getCommentById(id) {
  const idStr = String(id);
  const found = comments.find((c) => String(c.id) === idStr);
  return found ? sanitiseComment(found) : null;
}

function createComment({ artistId, author, text }) {
  const now = new Date().toISOString();

  const comment = {
    id: nextCommentId++,
    artistId: String(artistId),
    author: author && String(author).trim() ? String(author).trim() : "Anonymous",
    text: text.trim(),
    createdAt: now,
  };

  comments.push(comment);
  return sanitiseComment(comment);
}

function deleteComment(id) {
  const idStr = String(id);
  const index = comments.findIndex((c) => String(c.id) === idStr);

  if (index === -1) {
    return null;
  }

  const [deleted] = comments.splice(index, 1);
  return sanitiseComment(deleted);
}

function deleteCommentsByArtist(artistId) {
  const artistIdStr = String(artistId);
  const before = comments.length;

  comments = comments.filter(
    (c) => String(c.artistId) !== artistIdStr
  );

  const deleted = before - comments.length;
  return {
    deleted,
    artistId: artistIdStr,
  };
}

function resetComments() {
  const deleted = comments.length;
  comments = [];
  nextCommentId = 1;
  return deleted;
}

module.exports = {
  getAllComments,
  getCommentsByArtist,
  getCommentById,
  createComment,
  deleteComment,
  deleteCommentsByArtist,
  resetComments,
};