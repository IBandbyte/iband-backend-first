// routes/safety.js
const express = require('express');
const router = express.Router();

const {
  rateLimitOk,
  createPanicCase,
  ackCase,
  resolveCase,
  getCase,
  listCases
} = require('../services/safetyService');

// POST /api/safety/panic
router.post('/panic', (req, res) => {
  try {
    const userId = (req.body?.userId || 'anon').toString();

    if (!rateLimitOk(userId)) {
      return res.status(429).json({ error: 'Too many panic requests. Please wait a minute.' });
    }

    const record = createPanicCase({
      userId,
      category: req.body?.category,
      message: req.body?.message,
      contentId: req.body?.contentId,
      liveId: req.body?.liveId,
      notifyLaw: !!req.body?.notifyLaw,
      evidenceUrls: req.body?.evidenceUrls
    });

    res.status(201).json({ success: true, case: record });
  } catch (e) {
    console.error('POST /api/safety/panic error', e);
    res.status(500).json({ error: 'Failed to create panic case' });
  }
});

// GET /api/safety/cases
router.get('/cases', (req, res) => {
  const { status, limit } = req.query;
  const list = listCases({ status, limit: parseInt(limit || '50', 10) });
  res.json({ count: list.length, cases: list });
});

// GET /api/safety/cases/:id
router.get('/cases/:id', (req, res) => {
  const rec = getCase(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Not found' });
  res.json(rec);
});

// POST /api/safety/cases/:id/ack
router.post('/cases/:id/ack', (req, res) => {
  const rec = ackCase(req.params.id, req.body?.moderator);
  if (!rec) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true, case: rec });
});

// POST /api/safety/cases/:id/resolve
router.post('/cases/:id/resolve', (req, res) => {
  const rec = resolveCase(req.params.id, req.body?.outcome, req.body?.moderator);
  if (!rec) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true, case: rec });
});

module.exports = router;