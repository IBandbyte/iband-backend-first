// routes/artists.fake.js
// Tiny adapter so tests can `require('../routes/artists.fake')` and hit the real artists router.

const express = require('express');
const router = express.Router();

// Reuse the existing root-level artists.js handlers under this mounted router.
router.use('/', require('../artists'));

module.exports = router;