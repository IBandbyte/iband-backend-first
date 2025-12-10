// services/commentsService.js
// Handles all comment-related logic (in-memory for now).

let comments = [];
let nextId = 1;

module.exports = {
  // Create a new comment
  async addComment(artistId, data) {
    const newComment = {
      id: nextId++,
      artistId: Number(artistId),
      user: data.user || "Anonymous",
      text: data.text || "",
      createdAt: new Date().toISOString(),
    };

    comments.push(newComment);
    return newComment;
  },

  // Get all comments for a single artist
  async getCommentsByArtist(artistId) {
    return comments.filter(c => c.artistId === Number(artistId));
  },

  // Admin — get ALL comments
  async getAllComments() {
    return comments;
  },

  // Admin — delete a comment
  async deleteComment(commentId) {
    const index = comments.findIndex(c => c.id === Number(commentId));
    if (index === -1) return null;

    const removed = comments[index];
    comments.splice(index, 1);
    return removed;
  }
};