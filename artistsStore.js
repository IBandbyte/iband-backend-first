// artistsStore.js
// Simple in-memory artist store used by both public + admin routes.

let artists = [
  {
    id: "1",
    name: "Aria Nova",
    genre: "Pop",
    bio: "Rising star blending catchy hooks with emotional lyrics.",
    imageUrl: "https://example.com/aria.jpg"
  },
  {
    id: "2",
    name: "Midnight Echo",
    genre: "Indie Rock",
    bio: "Raw guitars, smoky vocals, and late-night anthems.",
    imageUrl: "https://example.com/midnight.jpg"
  },
  {
    id: "3",
    name: "Luna Waves",
    genre: "Electronic",
    bio: "Atmospheric beats and cosmic soundscapes.",
    imageUrl: "https://example.com/luna.jpg"
  }
];

function getAllArtists() {
  return artists;
}

function getArtistById(id) {
  return artists.find((artist) => artist.id === String(id)) || null;
}

function getNextId() {
  if (!artists.length) return "1";
  const maxNumericId = artists
    .map((a) => Number(a.id) || 0)
    .reduce((max, current) => (current > max ? current : max), 0);
  return String(maxNumericId + 1);
}

function addArtist({ name, genre, bio = "", imageUrl = "" }) {
  const id = getNextId();
  const artist = { id, name, genre, bio, imageUrl };
  artists.push(artist);
  return artist;
}

function resetArtists() {
  const deleted = artists.length;
  artists = [];
  return { deleted };
}

module.exports = {
  getAllArtists,
  getArtistById,
  addArtist,
  resetArtists
};