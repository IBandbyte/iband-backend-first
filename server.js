/* eslint-env node */

// server.js — iBandbyte backend (modular, stable, ready for Render)

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// --- Middleware ---
// Allow cross-origin calls
app.use(cors());

// Accept common JSON variants (helps mobile/webviews that add charset or custom types)
app.use(
  express.json({
    type: ['application/json', 'application/*+json', 'application/json; charset=utf-8', '*/*'],
  })
);
// Parse URL-encoded bodies (form posts)
app.use(express.urlencoded({ extended: true }));

// Debug logging — show incoming PATCH bodies (temporary; remove in prod)
app.use((req, _res, next) => {
  if (req.method === 'PATCH') {
    // eslint-disable-next-line no-console
    console.log('PATCH body at app-level →', req.headers['content-type'], req.body);
  }
  next();
});

// --- Routes ---
// NOTE: artists.js lives at project root as artists.js
app.use('/artists', require('./artists')); // public read/update API (root-level artists.js)

// safety/admin routes (exists in /routes)
app.use('/api/safety', require('./routes/safety'));
app.use('/api/votes', require('./routes/votes')); // votes API

// Health + root
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'iband-backend',
    mongoUriPresent: Boolean(process.env.MONGO_URI || process.env.MONGODB_URI),
    env: process.env.RENDER ? 'render' : 'local',
  });
});

app.get('/', (_req, res) => res.json({ ok: true, service: 'iband-backend' }));

// --- Start (test-friendly) ---
const PORT = process.env.PORT || 10000;
const MONGO = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO) {
  // eslint-disable-next-line no-console
  console.error('❌ No Mongo connection string found (MONGO_URI / MONGODB_URI).');
} else {
  mongoose
    .connect(MONGO)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log('✅ MongoDB connected');
      // Only start the server if this file is executed directly (not required by tests)
      if (require.main === module) {
        app.listen(PORT, () => console.log(`🚀 Server running on :${PORT}`));
      }
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('❌ MongoDB error:', err.message);
      // Don't exit here when running inside test harness; let caller decide
    });
}

// Export app for tests and for manual server start via separate runner
module.exports = app;