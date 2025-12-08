const Artists = require("../db/artists");

async function getAllArtists() {
  return await Artists.getAllArtists();
}

async function getArtistById(id) {
  return await Artists.getArtistById(id);
}

async function createArtist(data) {
  return await Artists.createArtist(data);
}

async function updateArtist(id, data) {
  return await Artists.updateArtist(id, data);
}

async function deleteArtist(id) {
  return await Artists.deleteArtist(id);
}

module.exports = {
  getAllArtists,
  getArtistById,
  createArtist,
  updateArtist,
  deleteArtist
};