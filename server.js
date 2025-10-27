/* eslint-env node */
/* global Buffer */

// server.js — iBandbyte backend (root-level)
// Full app wiring: parsers, routes, mongo, health

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// --------------------
// Middleware
// --------------------
app.use(cors());

// Universal JSON parser (accept common mobile/web variants)
app.use(
  express.json({
    type: ['application/json', 'application/*+json', 'application/json; charset=utf-8', '*/*'],
  })
);
app.use(express.urlencoded({ extended: true }));

// Small debug logger for PATCH bodies (safe for dev)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    if (req.method === 'PATCH') {
      // eslint-disable-next-line no-console
      console.log('PATCH body →', req.headers['content-type'], req.body);
    }
    next();
  });
}

// --------------------
// Health & root
// --------------------
app.get('/', (_req, res) => res.status(200).json({ ok: true, service: 'iband-backend' }));

app.get('/health', (_req, res) =>
  res.status(200).json({
    ok: true,
    service: 'iband-backend',
    mongoUriPresent: Boolean(process.env.MONGO_URI || process.env.MONGODB_URI),
    env: process.env.RENDER ? 'render' : process.env.NODE_ENV || 'local',
  })
);

// --------------------
// Routes (note: artists.js lives at project root)
 // artists.js is at project root (not ./routes/artists)
const artistRoutes = require('./artists');
const commentsRoutes = require('./comments');      // root-level comments.js
const votesRoutes = require('./routes/votes');    // existing in /routes
const safetyRoutes = require('./routes/safety');  // existing in /routes

app.use('/artists', artistRoutes);
app.use('/comments', commentsRoutes);
app.use('/api/votes', votesRoutes);
app.use('/api/safety', safetyRoutes);

// --------------------
// Mongo + Start
// --------------------
const PORT = process.env.PORT || 10000;
const MONGO =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO ||
  // keep this placeholder harmless; replace with real URI in env
  'mongodb://127.0.0.1:27017/iband';

async function start() {
  try {
    // eslint-disable-next-line no-console
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO, {
      // options can be added if needed
    });
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