// routes/artists.fake.js
// Adapter so tests can import ../routes/artists.fake
const express = require('express');
const router = express.Router();

// Reuse existing root-level artists.js handler
router.use('/', require('../artists'));

module.exports = router;