// artistsStore.js
// Central in-memory store for all artist data + admin helpers.

let artists = [];

// Demo seed data for iBand
const SEED_ARTISTS = [
  {
    id: "1",
    name: "Aria Nova",
    genre: "Hyper Pop",
    bio: "A cosmic vocal powerhouse bending pop into new dimensions.",
    imageUrl: "https://example.com/aria-nova.jpg",
  },
  {
    id: "2",
    name: "Captain Sex",
    genre: "Cosmic Pop",
    bio: "Commander of interstellar A&R, broadcasting bangers from deep space.",
    imageUrl: "https://example.com/captain-sex.jpg",
  },
  {
    id: "3",
    name: "Quantum Ghost",
    genre: "Alt Trap",
    bio: "Haunting 808s from a different timeline.",
    imageUrl: "https://example.com/quantum-ghost.jpg",
  },
];

let nextId = 1;

function applySeed() {
  // Deep clone the seed data so mutations never affect the original array.
  artists = SEED_ARTISTS.map((artist) => ({ ...artist }));
  const maxId = artists.reduce((max, artist) => {
    const numericId = Number(artist.id) || 0;
    return numericId > max ? numericId : max;
  }, 0);
  nextId = maxId + 1;
}

// Initialize store with seed data on startup
applySeed();

// ────────────────────────────────────────────────────────────────
// Public store functions
// ────────────────────────────────────────────────────────────────

function getAllArtists() {
  return artists.map((artist) => ({ ...artist }));
}

function getArtistById(id) {
  const targetId = String(id);
  const artist = artists.find((a) => a.id === targetId);
  return artist ? { ...artist } : null;
}

function createArtist(data) {
  const newArtist = {
    id: String(nextId++),
    name: data.name,
    genre: data.genre || "",
    bio: data.bio || "",
    imageUrl: data.imageUrl || "",
  };

  artists.push(newArtist);
  return { ...newArtist };
}

function updateArtist(id, data) {
  const targetId = String(id);
  const index = artists.findIndex((a) => a.id === targetId);

  if (index === -1) {
    return null;
  }

  const updated = {
    id: targetId,
    name: data.name,
    genre: data.genre || "",
    bio: data.bio || "",
    imageUrl: data.imageUrl || "",
  };

  artists[index] = updated;
  return { ...updated };
}

function patchArtist(id, changes) {
  const targetId = String(id);
  const index = artists.findIndex((a) => a.id === targetId);

  if (index === -1) {
    return null;
  }

  const current = artists[index];

  const patched = {
    ...current,
    ...changes,
    id: targetId, // never allow ID to be changed
  };

  artists[index] = patched;
  return { ...patched };
}

function deleteArtist(id) {
  const targetId = String(id);
  const index = artists.findIndex((a) => a.id === targetId);

  if (index === -1) {
    return null;
  }

  const [removed] = artists.splice(index, 1);
  return { ...removed };
}

function resetArtists() {
  const deleted = artists.length;
  artists = [];
  nextId = 1;
  return { deleted };
}

function seedArtists() {
  applySeed();
  return { seeded: artists.length };
}

module.exports = {
  getAllArtists,
  getArtistById,
  createArtist,
  updateArtist,
  patchArtist,
  deleteArtist,
  resetArtists,
  seedArtists,
};