/* eslint-env node */
/* global Buffer */

// server.js — iBandbyte backend (root-level)
// Full app wiring: parsers, routes, mongo, health

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

/* --------------------
 * Middleware
 * ------------------ */
app.use(cors());

// Universal JSON parser (accept common mobile/web variants)
app.use(
  express.json({
    type: [
      'application/json',
      'application/*+json',
      'application/json; charset=utf-8',
      '*/*',
    ],
  })
);
app.use(express.urlencoded({ extended: true }));

// Tiny debug logger for PATCH bodies (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    if (req.method === 'PATCH') {
      // eslint-disable-next-line no-console
      console.log('PATCH body →', req.headers['content-type'], req.body);
    }
    next();
  });
}

/* --------------------
 * Health & Root
 * ------------------ */
app.get('/', (_req, res) =>
  res.status(200).json({ ok: true, service: 'iband-backend' })
);

app.get('/health', (_req, res) =>
  res.status(200).json({
    ok: true,
    service: 'iband-backend',
    mongoUriPresent: Boolean(process.env.MONGO_URI || process.env.MONGODB_URI),
    env: process.env.RENDER ? 'render' : process.env.NODE_ENV || 'local',
  })
);

/* --------------------
 * Routes
 * ------------------ */
// artists.js & comments.js live at repo root
const artistRoutes = require('./artists');
const commentsRoutes = require('./comments');

// votes & safety are in /routes
const votesRouter = require('./routes/votes');
const safetyRoutes = require('./routes/safety');

// Mount with the intended public paths:
app.use('/artists', artistRoutes);     // GET /artists, POST /artists, etc.
app.use('/comments', commentsRoutes);  // GET /comments, POST /comments

// IMPORTANT: mount votes router at root so /votes works (no /api prefix)
app.use(votesRouter);                  // GET /votes, GET /votes/:id, POST /artists/:id/vote

// Safety can stay under /api if you prefer; here we expose it as-is:
app.use('/api/safety', safetyRoutes);

/* --------------------
 * Mongo + Start
 * ------------------ */
const PORT = process.env.PORT || 10000;
const MONGO =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO ||
  'mongodb://127.0.0.1:27017/iband';

async function start() {
  try {
    // eslint-disable-next-line no-console
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO);
    // eslint-disable-next-line no-console
    console.log('✅ MongoDB connected');

    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`🚀 Server running on :${PORT}`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Mongo connection/start error:', err);
    process.exit(1);
  }
}

start();

module.exports = app;