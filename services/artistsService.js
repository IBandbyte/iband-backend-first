// services/artistsService.js
// Service layer for artist CRUD using db/artists

const Artists = require("../db/artists");

// Get all artists
async function getAllArtists() {
  return await Artists.getAllArtists();
}

// Get a single artist by ID
async function getArtistById(id) {
  return await Artists.getArtistById(id);
}

// Create a new artist
async function createArtist(data) {
  const name = data.name || "";
  const genre = data.genre || "";
  const bio = data.bio || "";
  const imageUrl = data.imageUrl || "";

  if (!name || !genre) {
    throw new Error("name and genre are required.");
  }

  // db/artists.createArtist currently returns { id }
  const result = await Artists.createArtist(name, genre, bio, imageUrl);

  // Fetch full row from DB
  const created = await Artists.getArtistById(result.id);
  return created;
}

// Update an existing artist
async function updateArtist(id, fields) {
  // db/artists.updateArtist returns { changes }
  const result = await Artists.updateArtist(id, fields);

  if (!result || !result.changes) {
    // no row updated
    return null;
  }

  const updated = await Artists.getArtistById(id);
  return updated;
}

// Delete an artist
async function deleteArtist(id) {
  const result = await Artists.deleteArtist(id);

  if (!result || !result.changes) {
    return null;
  }

  return { id };
}

module.exports = {
  getAllArtists,
  getArtistById,
  createArtist,
  updateArtist,
  deleteArtist,
};