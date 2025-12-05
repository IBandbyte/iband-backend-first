// artistsStore.js
// Shared in-memory "database" for artists.
// Used by both artists.js (public API) and admin.js (admin API).

// --- internal state ---
// Seed demo artists (same flavour as before).
let artists = [
  {
    id: "1",
    name: "Aria Nova",
    genre: "Pop",
    bio: "Rising star blending electro-pop with dreamy vocals.",
    imageUrl: "https://i.imgur.com/XYZ123a.jpg",
    votes: 0,
    commentsCount: 0,
  },
  {
    id: "2",
    name: "Neon Harbor",
    genre: "Synthwave",
    bio: "Retro-futuristic vibes, heavy synth, 80s nostalgia.",
    imageUrl: "https://i.imgur.com/XYZ123b.jpg",
    votes: 0,
    commentsCount: 0,
  },
  {
    id: "3",
    name: "Stone & Sparrow",
    genre: "Indie Folk",
    bio: "Acoustic harmonies, storytelling, and soulful strings.",
    imageUrl: "https://i.imgur.com/XYZ123c.jpg",
    votes: 0,
    commentsCount: 0,
  },
];

// --- helpers ---

function cloneArtist(a) {
  return { ...a };
}

function nextId() {
  if (artists.length === 0) return "1";
  const maxNumeric = artists.reduce((max, a) => {
    const n = parseInt(a.id, 10);
    if (Number.isNaN(n)) return max;
    return n > max ? n : max;
  }, 0);
  return String(maxNumeric + 1);
}

// --- CRUD operations ---

function getAllArtists() {
  return artists.map(cloneArtist);
}

function getArtistById(id) {
  const found = artists.find((a) => String(a.id) === String(id));
  return found ? cloneArtist(found) : null;
}

function createArtist({ name, genre, bio, imageUrl }) {
  const artist = {
    id: nextId(),
    name: name?.trim() || "Untitled Artist",
    genre: genre?.trim() || "No genre set",
    bio: bio?.trim() || "",
    imageUrl: imageUrl?.trim() || "",
    votes: 0,
    commentsCount: 0,
  };
  artists.push(artist);
  return cloneArtist(artist);
}

function updateArtist(id, patch) {
  const idx = artists.findIndex((a) => String(a.id) === String(id));
  if (idx === -1) return null;

  const current = artists[idx];
  const updated = {
    ...current,
    // Only overwrite fields if provided (undefined means "leave as is")
    name: patch.name !== undefined ? String(patch.name).trim() || current.name : current.name,
    genre:
      patch.genre !== undefined
        ? String(patch.genre).trim() || current.genre
        : current.genre,
    bio:
      patch.bio !== undefined
        ? String(patch.bio).trim()
        : current.bio,
    imageUrl:
      patch.imageUrl !== undefined
        ? String(patch.imageUrl).trim()
        : current.imageUrl,
  };

  artists[idx] = updated;
  return cloneArtist(updated);
}

function deleteArtist(id) {
  const before = artists.length;
  artists = artists.filter((a) => String(a.id) !== String(id));
  return artists.length < before;
}

// --- admin utilities ---

function resetArtists() {
  const deleted = artists.length;
  artists = [];
  return deleted;
}

function seedDemoArtists() {
  const demo = [
    {
      id: "1",
      name: "Aria Nova",
      genre: "Pop",
      bio: "Rising star blending electro-pop with dreamy vocals.",
      imageUrl: "https://i.imgur.com/XYZ123a.jpg",
      votes: 0,
      commentsCount: 0,
    },
    {
      id: "2",
      name: "Neon Harbor",
      genre: "Synthwave",
      bio: "Retro-futuristic vibes, heavy synth, 80s nostalgia.",
      imageUrl: "https://i.imgur.com/XYZ123b.jpg",
      votes: 0,
      commentsCount: 0,
    },
    {
      id: "3",
      name: "Stone & Sparrow",
      genre: "Indie Folk",
      bio: "Acoustic harmonies, storytelling, and soulful strings.",
      imageUrl: "https://i.imgur.com/XYZ123c.jpg",
      votes: 0,
      commentsCount: 0,
    },
  ];
  artists = demo.map(cloneArtist);
  return artists.length;
}

module.exports = {
  // CRUD
  getAllArtists,
  getArtistById,
  createArtist,
  updateArtist,
  deleteArtist,
  // admin helpers
  resetArtists,
  seedDemoArtists,
};