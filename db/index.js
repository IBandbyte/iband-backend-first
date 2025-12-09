// db/index.js
// Central DB export for the iBand backend.
//
// Right now we are using a simple in-memory "artists" store
// implemented in ./artists.js.
//
// Any module that does:
//   const db = require("../db");
// will get access to the same artist data and helpers used by the
// admin routes, so the public /api/artists endpoints and the
// /api/admin/artists endpoints stay perfectly in sync.

const artistsModule = require("./artists");

// Re-export everything from ./artists so callers can either
// grab specific helpers or the raw artists array if needed.
module.exports = {
  ...artistsModule,
};