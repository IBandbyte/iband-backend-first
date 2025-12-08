const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.join(__dirname, "artists.db");

// Create or open SQLite database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ Failed to connect to SQLite DB:", err.message);
  } else {
    console.log("✅ Connected to SQLite database at:", dbPath);
  }
});

module.exports = db;