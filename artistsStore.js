// artistsStore.js
// Simple in-memory artist store for iBand backend
// No external DB – safe for Render and easy to extend later.

const normalizeId = (id) => String(id);

// Seed data – you can tweak these later
let artists = [
  {
    id: '1',
    name: 'Bad Bunny',
    genre: 'Reggaeton / Latin Trap',
    bio: 'Global superstar and genre-bending artist.',
    imageUrl: 'https://example.com/badbunny.jpg',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Billie Eilish',
    genre: 'Pop / Alternative',
    bio: 'Whisper-pop icon with a dark cinematic sound.',
    imageUrl: 'https://example.com/billie.jpg',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Travis Scott',
    genre: 'Hip-Hop / Trap',
    bio: 'High-energy performer and producer.',
    imageUrl: 'https://example.com/travis.jpg',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let lastId = artists.length
  ? Math.max(...artists.map((a) => Number(a.id) || 0))
  : 0;

// Core helpers
function getAll() {
  return artists;
}

function getById(id) {
  const targetId = normalizeId(id);
  return artists.find((artist) => normalizeId(artist.id) === targetId) || null;
}

function create(data) {
  lastId += 1;
  const now = new Date().toISOString();

  const artist = {
    id: String(lastId),
    name: data.name || 'Untitled Artist',
    genre: data.genre || '',
    bio: data.bio || '',
    imageUrl: data.imageUrl || '',
    createdAt: now,
    updatedAt: now,
  };

  artists.push(artist);
  return artist;
}

function update(id, data) {
  const artist = getById(id);
  if (!artist) return null;

  if (data.name !== undefined) artist.name = data.name;
  if (data.genre !== undefined) artist.genre = data.genre;
  if (data.bio !== undefined) artist.bio = data.bio;
  if (data.imageUrl !== undefined) artist.imageUrl = data.imageUrl;

  artist.updatedAt = new Date().toISOString();
  return artist;
}

function remove(id) {
  const targetId = normalizeId(id);
  const index = artists.findIndex(
    (artist) => normalizeId(artist.id) === targetId
  );

  if (index === -1) return null;

  const [removed] = artists.splice(index, 1);
  return removed;
}

module.exports = {
  // Primary API – used by routes
  getAll,
  getById,
  create,
  update,
  remove,

  // Extra aliases (in case any route uses these names)
  list: () => getAll(),
  findById: (id) => getById(id),
  createArtist: (data) => create(data),
  updateArtist: (id, data) => update(id, data),
  deleteArtist: (id) => remove(id),
};