// db/index.js
// Simple in-memory "DB" for admin-created artists.
// No external database or extra npm packages required.

const inMemoryStore = {
  artists: [],
};

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

  return inMemoryStore.artists.find((artist) => artist.id === numericId) || null;
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

  const nextId =
    inMemoryStore.artists.length > 0
      ? inMemoryStore.artists[inMemoryStore.artists.length - 1].id + 1
      : 1;

  const now = new Date().toISOString();

  const artist = {
    id: nextId,
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

module.exports = {
  // expose the raw store for read-only access if needed
  ...inMemoryStore,
  // helpers
  getAllArtists,
  getArtistById,
  createArtist,
  updateArtist,
  deleteArtist,
};