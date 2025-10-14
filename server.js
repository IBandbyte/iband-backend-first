/* eslint-env node */

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// ----------------------------------------------
// Routers (match your repo layout)
// ----------------------------------------------
// artists.js is at the project root (NOT ./routes/artists)
const artistRoutes = require('./artists');
// these two live under /routes
const votesRoutes = require('./routes/votes');
const safetyRoutes = require('./routes/safety');

const app = express();

// ----------------------------------------------
// Core middleware
// ----------------------------------------------
app.use(cors());

// Accept JSON from browsers/mobile webviews that send odd content-types
app.use(
  express.json({
    type: [
      'application/json',
      'application/*+json',
      'application/json; charset=utf-8',
      '*/*', // last-resort to parse JSON bodies if header is weird
    ],
  })
);
app.use(express.urlencoded({ extended: true }));

// Temporary debug log to see PATCH bodies arriving from Hoppscotch
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    if (req.method === 'PATCH') {
      // eslint-disable-next-line no-console
      console.log('PATCH body →', req.headers['content-type'], req.body);
    }
    next();
  });
}

// ----------------------------------------------
// Health
// ----------------------------------------------
app.get('/', (_req, res) => {
  res.status(200).json({ ok: true, service: 'iband-backend' });
});

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

// ----------------------------------------------
// Routes
// ----------------------------------------------
app.use('/artists', artistRoutes);
app.use('/api/votes', votesRoutes);   // keep existing mount point
app.use('/api/safety', safetyRoutes); // keep existing mount point

// ----------------------------------------------
// Mongo connection + start
// ----------------------------------------------
const PORT = process.env.PORT || 10000;
const MONGO_URL =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  'mongodb+srv://readonly:readonly@cluster0.example.mongodb.net/iband?retryWrites=true&w=majority';

async function start() {
  try {
    // eslint-disable-next-line no-console
    console.log('Connecting to MongoDB…');
    await mongoose.connect(MONGO_URL);
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