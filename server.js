// server.js — iBandbyte backend (modular, stable, ready for Render)

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// --- Middleware ---
app.use(cors());                 // allow your frontend to call this API
app.use(express.json());         // parse JSON bodies

// --- MongoDB Connection (supports either env name) ---
const MONGO = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO) {
  console.error('❌ No Mongo connection string found (MONGO_URI / MONGODB_URI).');
  // We don’t exit here because CI routes (artists fallback & votes service) can still run without DB.
} else {
  mongoose
    .connect(MONGO)
    .then(() => console.log('✅ MongoDB connected'))
    .catch((err) => {
      console.error('❌ MongoDB error:', err.message);
      // Don’t exit; routes have no-DB fallbacks for CI.
    });
}

// --- Routes ---
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'iband-backend',
    mongoUriPresent: Boolean(MONGO),
    env: process.env.RENDER ? 'render' : 'local',
    mongoState: mongoose?.connection?.readyState ?? 0,
  });
});

// Public read API (Artists)
// NOTE: artists.js lives at project root per your repo structure.
app.use('/artists', require('./artists'));

// Admin API (if present in your repo)
try {
  app.use('/admin', require('./admin')); // optional
} catch (_) {
  // ignore if admin module not present in this branch
}

// 🔐 Safety / Panic API
try {
  const safetyRoutes = require('./routes/safety');
  app.use('/api/safety', safetyRoutes);
} catch (_) {
  // ignore if not present locally
}

// 🗳 Votes API — mounted at /api/votes
try {
  const votesRoutes = require('./routes/votes');
  app.use('/api/votes', votesRoutes);
} catch (err) {
  console.error('Votes router missing:', err?.message);
}

// Root
app.get('/', (_req, res) => res.json({ ok: true, service: 'iband-backend' }));

// --- Start ---
const PORT = process.env.PORT || 10000;    // Render expects 10000
app.listen(PORT, () => console.log(`🚀 Server running on :${PORT}`));