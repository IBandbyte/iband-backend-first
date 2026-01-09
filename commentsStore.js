/**
 * In-memory comments store
 * ESM compatible
 */

let comments = [];
let nextId = 1;

export function getAllComments() {
  return comments;
}

export function getCommentsByArtistId(artistId) {
  return comments.filter(
    (comment) => comment.artistId === String(artistId)
  );
}

export function addComment({ artistId, author, text }) {
  const newComment = {
    id: String(nextId++),
    artistId: String(artistId),
    author,
    text,
    createdAt: new Date().toISOString(),
  };

  comments.push(newComment);
  return newComment;
}

export function deleteAllComments() {
  const deleted = comments.length;
  comments = [];
  nextId = 1;
  return deleted;
}