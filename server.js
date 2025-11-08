/* eslint-env node */

// server.js — iBandbyte backend (root-level)
// Wires middleware, routes, Mongo, health.
// Layout assumed:
//   - /server.js
//   - /artists.js
//   - /comments.js
//   - /routes/votes.js
//   - /utils/isObjectId.js   (optional, nice-to-have)

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
    limit: '1mb',
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
// artists.js & comments.js are at repo root
const artistRoutes = require('./artists');
const commentsRoutes = require('./comments');

// votes & safety live under /routes (safety optional)
let votesRouter;
try {
  votesRouter = require('./routes/votes');
} catch {
  votesRouter = null;
}
let safetyRoutes;
try {
  safetyRoutes = require('./routes/safety');
} catch {
  safetyRoutes = null;
}

app.use('/artists', artistRoutes);
app.use('/comments', commentsRoutes);

// Mount votes either at /votes (preferred) or /api/votes if your frontend expects it.
// Here we expose /votes (and we also alias to /api/votes for compatibility).
if (votesRouter) {
  app.use('/votes', votesRouter);
  app.use('/api/votes', votesRouter);
}
if (safetyRoutes) {
  app.use('/api/safety', safetyRoutes);
}

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