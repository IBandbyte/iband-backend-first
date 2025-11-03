/* eslint-env node */
/* global Buffer */

// server.js — iBandbyte backend (root-level)

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

/* --------------------
 * Middleware
 * ------------------ */
app.use(cors());
app.use(express.json());                    // standard JSON parser
app.use(express.urlencoded({ extended: true }));

// Tiny debug logger for PATCH bodies (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    if (req.method === 'PATCH') {
      console.log('PATCH body →', req.headers['content-type'], req.body);
    }
    next();
  });
}

/* --------------------
 * Health & Root
 * ------------------ */
app.get('/', (_req, res) => {
  res.status(200).json({ ok: true, service: 'iband-backend' });
});

app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'iband-backend',
    mongoUriPresent: Boolean(process.env.MONGO_URI || process.env.MONGODB_URI),
    env: process.env.RENDER ? 'render' : process.env.NODE_ENV || 'local',
  });
});

/* --------------------
 * Routes
 * ------------------ */
// Root-level routes
const artistRoutes = require('./artists');
const commentsRoutes = require('./comments');

// /routes folder
const votesRouter = require('./routes/votes');
const safetyRoutes = require('./routes/safety');

// Mount with public paths
app.use('/artists', artistRoutes);
app.use('/comments', commentsRoutes);

// votes router exports paths starting with /votes and /artists/:id/vote
app.use(votesRouter);

// keep safety under /api
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
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO, {
      // these options are safe across modern drivers
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 15000,
    });
    console.log('✅ MongoDB connected');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on :${PORT}`);
    });
  } catch (err) {
    console.error('Mongo connection/start error:', err?.message || err);
    process.exit(1);
  }
}

start();

module.exports = app;