const express = require('express');
const router = express.Router();
router.get('/status', (req, res) => res.json({ ok: true, role: 'admin', message: 'Admin API is reachable' }));
module.exports = router;
