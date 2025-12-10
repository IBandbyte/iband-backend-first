// db/index.js
// Simple in-memory "DB" for iBand backend.
// Stores admin-created artists, their votes, and their comments.

const inMemoryStore = {
  artists: [],
};

let nextArtistId = 1;
let nextCommentId = 1;

/**
 * Return a shallow copy of all admin-created artists.
 */
function getAllArtists() {
  return [...inMemoryStore.artists];
}

/**
 * Find a single artist by numeric id.
 * Accepts number or string that can be converted to a number.
 */
function getArtistById(id) {
  const numericId = Number(id);
  if (Number.isNaN(numericId)) return null;

  return (
    inMemoryStore.artists.find((artist) => artist.id === numericId) || null
  );
}

/**
 * Create a new artist.
 * Expects at least { name, genre } in the payload.
 */
function createArtist(payload = {}) {
  const { name, genre, bio = "", imageUrl = "" } = payload;

  if (!name || !genre) {
    throw new Error("name and genre are required to create an artist.");
  }

  const now = new Date().toISOString();

  const artist = {
    id: nextArtistId++,
    name,
    genre,
    bio,
    imageUrl,
    votes: 0,
    comments: [],
    createdAt: now,
    updatedAt: now,
  };

  inMemoryStore.artists.push(artist);
  return artist;
}

/**
 * Update an existing artist.
 * Allows partial updates (name, genre, bio, imageUrl).
 * Returns the updated artist or null if not found.
 */
function updateArtist(id, updates = {}) {
  const artist = getArtistById(id);
  if (!artist) return null;

  const allowedFields = ["name", "genre", "bio", "imageUrl"];

  allowedFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      artist[field] = updates[field];
    }
  });

  artist.updatedAt = new Date().toISOString();
  return artist;
}

/**
 * Delete an artist by id.
 * Returns the removed artist or null if not found.
 */
function deleteArtist(id) {
  const numericId = Number(id);
  if (Number.isNaN(numericId)) return null;

  const index = inMemoryStore.artists.findIndex(
    (artist) => artist.id === numericId
  );

  if (index === -1) return null;

  const [removed] = inMemoryStore.artists.splice(index, 1);
  return removed;
}

/**
 * Add 1 vote to an artist.
 * Returns the updated artist or null if not found.
 */
function voteForArtist(id) {
  const artist = getArtistById(id);
  if (!artist) return null;

  artist.votes = (artist.votes || 0) + 1;
  artist.updatedAt = new Date().toISOString();
  return artist;
}

/**
 * Add a comment to an artist.
 * Expects { user, text } in payload.
 * Returns the created comment or null if artist not found.
 */
function addComment(artistId, payload = {}) {
  const artist = getArtistById(artistId);
  if (!artist) return null;

  const { user = "Anonymous Fan", text = "" } = payload;
  if (!text || !text.trim()) {
    throw new Error("Comment text is required.");
  }

  const comment = {
    id: nextCommentId++,
    artistId: artist.id,
    user,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };

  artist.comments.push(comment);
  artist.updatedAt = new Date().toISOString();

  return comment;
}

/**
 * Get all comments for a single artist.
 * Returns an array (possibly empty) or null if artist not found.
 */
function getCommentsForArtist(artistId) {
  const artist = getArtistById(artistId);
  if (!artist) return null;

  return [...artist.comments];
}

/**
 * Delete a comment by comment id (searching across all artists).
 * Returns the deleted comment or null if not found.
 */
function deleteComment(commentId) {
  const numericId = Number(commentId);
  if (Number.isNaN(numericId)) return null;

  for (const artist of inMemoryStore.artists) {
    const idx = artist.comments.findIndex((c) => c.id === numericId);
    if (idx !== -1) {
      const [removed] = artist.comments.splice(idx, 1);
      artist.updatedAt = new Date().toISOString();
      return removed;
    }
  }

  return null;
}

module.exports = {
  // raw store
  ...inMemoryStore,
  // artist helpers
  getAllArtists,
  getArtistById,
  createArtist,
  updateArtist,
  deleteArtist,
  // votes
  voteForArtist,
  // comments
  addComment,
  getCommentsForArtist,
  deleteComment,
};