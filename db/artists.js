const db = require("./index");

// Create artist
exports.createArtist = (name, genre, bio, imageUrl) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO artists (name, genre, bio, imageUrl)
      VALUES (?, ?, ?, ?)
    `;

    db.run(sql, [name, genre, bio, imageUrl], function (err) {
      if (err) {
        return reject(err);
      }
      resolve({ id: this.lastID });
    });
  });
};

// Get all artists
exports.getAllArtists = () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM artists ORDER BY id DESC", [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

// Get artist by ID
exports.getArtistById = (id) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM artists WHERE id = ?", [id], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

// Update artist
exports.updateArtist = (id, fields) => {
  return new Promise((resolve, reject) => {
    const allowed = ["name", "genre", "bio", "imageUrl"];
    const updates = [];
    const values = [];

    for (const key of allowed) {
      if (fields[key]) {
        updates.push(`${key} = ?`);
        values.push(fields[key]);
      }
    }

    if (updates.length === 0) {
      return reject(new Error("No valid update fields provided"));
    }

    values.push(id);

    const sql = `
      UPDATE artists SET ${updates.join(", ")}
      WHERE id = ?
    `;

    db.run(sql, values, function (err) {
      if (err) return reject(err);
      resolve({ changes: this.changes });
    });
  });
};

// Delete artist
exports.deleteArtist = (id) => {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM artists WHERE id = ?", [id], function (err) {
      if (err) return reject(err);
      resolve({ changes: this.changes });
    });
  });
};