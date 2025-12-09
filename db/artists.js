// db/artists.js
// In-memory artist "DB" with async-style functions to match the service layer.
// This replaces the previous sqlite3-based implementation to avoid native
// dependencies on Render.

let artists = [];
let lastId = 0;

function nextId() {
  lastId += 1;
  return String(lastId);
}

// Create artist: returns { id }
exports.createArtist = (name, genre, bio, imageUrl) => {
  return new Promise((resolve) => {
    const id = nextId();
    const artist = {
      id,
      name,
      genre,
      bio,
      imageUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    artists.push(artist);
    resolve({ id });
  });
};

// Get all artists
exports.getAllArtists = () => {
  return new Promise((resolve) => {
    resolve([...artists]);
  });
};

// Get artist by ID
exports.getArtistById = (id) => {
  return new Promise((resolve) => {
    const found = artists.find((a) => String(a.id) === String(id)) || null;
    resolve(found);
  });
};

// Update artist: returns { changes }
exports.updateArtist = (id, fields) => {
  return new Promise((resolve) => {
    const idx = artists.findIndex((a) => String(a.id) === String(id));
    if (idx === -1) {
      return resolve({ changes: 0 });
    }

    const existing = artists[idx];

    const allowed = ["name", "genre", "bio", "imageUrl"];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        existing[key] = fields[key];
      }
    }

    existing.updatedAt = new Date().toISOString();
    artists[idx] = existing;

    resolve({ changes: 1 });
  });
};

// Delete artist: returns { changes }
exports.deleteArtist = (id) => {
  return new Promise((resolve) => {
    const idx = artists.findIndex((a) => String(a.id) === String(id));
    if (idx === -1) {
      return resolve({ changes: 0 });
    }
    artists.splice(idx, 1);
    resolve({ changes: 1 });
  });
};