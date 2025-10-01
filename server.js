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
  process.exit(1);
}

mongoose
  .connect(MONGO)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB error:', err.message);
    process.exit(1);
  });

// --- Routes ---
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'iband-backend',
    mongoUriPresent: Boolean(MONGO),
    env: process.env.RENDER ? 'render' : 'local',
  });
});

app.use('/artists', require('./artists')); // public read API (root-level artists.js)
app.use('/admin', require('./admin'));     // secured admin API

// 🔐 Safety / Panic API
const safetyRoutes = require('./routes/safety');
app.use('/api/safety', safetyRoutes);

// 🗳 Votes API (mounted at /api/votes)
const votesRoutes = require('./routes/votes');
app.use('/api/votes', votesRoutes);

// Root
app.get('/', (_req, res) => res.json({ ok: true, service: 'iband-backend' }));

// --- Start ---
const PORT = process.env.PORT || 10000;    // Render expects 10000
app.listen(PORT, () => console.log(`🚀 Server running on :${PORT}`));