// artistsStore.js
// In-memory artist store with safe default seeding and CRUD helpers

// Default demo artists – used when no custom seed data is provided
const DEFAULT_ARTISTS = [
  {
    id: "1",
    name: "Aria Nova",
    genre: "Galactic Pop",
    bio: "Sings across star systems with a voice that bends light.",
    imageUrl: "https://example.com/aria.jpg",
  },
  {
    id: "2",
    name: "Neon Tiger",
    genre: "Synthwave",
    bio: "Glowing through the night with retro-future riffs.",
    imageUrl: "https://example.com/tiger.jpg",
  },
  {
    id: "3",
    name: "Captain Sex",
    genre: "Cosmic Pop",
    bio: "Commander of interstellar A&R, cruising the charts at warp speed.",
    imageUrl: "https://example.com/captain.jpg",
  },
];

// Internal state
let artists = [...DEFAULT_ARTISTS];
let nextId = artists.length + 1;

// Helpers
function normalizeId(id) {
  return String(id);
}

// ===== Basic queries =====
function getAllArtists() {
  return [...artists];
}

function getArtistById(id) {
  const targetId = normalizeId(id);
  return artists.find((a) => normalizeId(a.id) === targetId) || null;
}

// ===== Mutations =====
function createArtist(payload = {}) {
  const artist = {
    id: String(nextId++),
    name: payload.name || "Untitled Artist",
    genre: payload.genre || "",
    bio: payload.bio || "",
    imageUrl: payload.imageUrl || "",
  };

  artists.push(artist);
  return artist;
}

function updateArtist(id, payload = {}) {
  const targetId = normalizeId(id);
  const index = artists.findIndex((a) => normalizeId(a.id) === targetId);

  if (index === -1) {
    return null;
  }

  const existing = artists[index];

  const updated = {
    ...existing,
    // Only override fields that are actually provided
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.genre !== undefined ? { genre: payload.genre } : {}),
    ...(payload.bio !== undefined ? { bio: payload.bio } : {}),
    ...(payload.imageUrl !== undefined ? { imageUrl: payload.imageUrl } : {}),
  };

  artists[index] = updated;
  return updated;
}

function deleteArtist(id) {
  const targetId = normalizeId(id);
  const index = artists.findIndex((a) => normalizeId(a.id) === targetId);

  if (index === -1) {
    return { deleted: false, artist: null };
  }

  const [removed] = artists.splice(index, 1);
  return { deleted: true, artist: removed };
}

// ===== Reset & Seed =====
function resetArtists() {
  const deleted = artists.length;
  artists = [];
  nextId = 1;
  return { deleted };
}

/**
 * Seed artists.
 * - If payload is empty/missing → use DEFAULT_ARTISTS
 * - If payload is a single object → wrap it in an array
 * - If payload is an array → use it directly
 */
function seedArtists(seedPayload) {
  let seedData;

  if (seedPayload && Object.keys(seedPayload).length > 0) {
    // Accept either a single object or an array
    seedData = Array.isArray(seedPayload) ? seedPayload : [seedPayload];
  } else {
    seedData = DEFAULT_ARTISTS;
  }

  // Hard reset first
  artists = [];
  nextId = 1;

  const created = seedData.map((item) => createArtist(item));
  return {
    seeded: created.length,
    artists: created,
    usedDefault: seedPayload == null || Object.keys(seedPayload).length === 0,
  };
}

module.exports = {
  DEFAULT_ARTISTS,
  getAllArtists,
  getArtistById,
  createArtist,
  updateArtist,
  deleteArtist,
  resetArtists,
  seedArtists,
};