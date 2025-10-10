// server.js — iBandbyte backend (stable + robust JSON parsing)

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

/* ---------- Middleware ---------- */
app.use(cors());

// Be generous with JSON parsing to handle odd mobile/webview headers
app.use(express.json({ type: ['application/json', 'application/*+json', '*/json', '*/*'] }));
app.use(express.urlencoded({ extended: true }));

// Tiny debug log for PATCH to artists — shows whether the body arrived
app.use((req, _res, next) => {
  if (req.method === 'PATCH' && req.url.startsWith('/artists/')) {
    console.log('PATCH body →', req.headers['content-type'], req.body);
  }
  next();
});

/* ---------- MongoDB ---------- */
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

/* ---------- Routes ---------- */
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'iband-backend',
    mongoUriPresent: Boolean(MONGO),
    env: process.env.RENDER ? 'render' : 'local',
  });
});

// ✅ Correct path (file is at project root: ./artists.js)
app.use('/artists', require('./artists'));

app.use('/admin', require('./admin'));

const safetyRoutes = require('./routes/safety');
app.use('/api/safety', safetyRoutes);

const votesRoutes = require('./routes/votes');
app.use('/api/votes', votesRoutes);

app.get('/', (_req, res) => res.json({ ok: true, service: 'iband-backend' }));

/* ---------- Start ---------- */
const PORT = process.env.PORT || 10000; // Render expects 10000
app.listen(PORT, () => console.log(`🚀 Server running on :${PORT}`));