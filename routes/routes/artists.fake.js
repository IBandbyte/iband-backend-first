// routes/artists.fake.js
// Very small adapter so tests can mount the same handler path.
// We just reuse your existing top-level artists module.

const express = require('express');
const router = express.Router();

// Mount the existing artists handler (the file at project root: artists.js)
router.use('/', require('../artists'));

module.exports = router;