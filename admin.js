const express = require('express');
const router = express.Router();

router.get('/ping', (_req, res) => res.json({ ok: true }));

module.exports = router;