/* eslint-env node */

const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

// Routers
const artistRoutes = require('./artists');        // artists.js is at project root
const votesRoutes = require('./routes/votes');    // exists
const safetyRoutes = require('./routes/safety');  // exists

const app = express();
app.use(cors());

/* -----------------------------------------------------------
   1) Capture RAW body for every request (any content-type)
   ----------------------------------------------------------- */
app.use((req, res, next) => {
  let data = [];
  req.on('data', (chunk) => data.push(chunk));
  req.on('end', () => {
    if (data.length) {
      const buf = Buffer.concat(data);
      req.rawBody = buf;                 // Buffer
      req.rawBodyText = buf.toString();  // string
    } else {
      req.rawBody = null;
      req.rawBodyText = '';
    }
    next();
  });
});

/* -----------------------------------------------------------
   2) Standard parsers (broadly permissive)
   ----------------------------------------------------------- */
app.use(
  express.json({
    type: [
      'application/json',
      'application/*+json',
      'application/json; charset=utf-8',
      '*/*', // last resort – try parsing anything as JSON
    ],
    strict: false, // accept JSON that is not strictly objects/arrays
  })
);
app.use(express.urlencoded({ extended: true }));

/* -----------------------------------------------------------
   3) Fallback: if body is empty but rawBody looks like JSON,
      parse it manually and attach to req.body
   ----------------------------------------------------------- */
app.use((req, _res, next) => {
  // If a parser already produced a non-empty object, keep it
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length) {
    return next();
  }

  const s = (req.rawBodyText || '').trim();
  if (s && (s.startsWith('{') || s.startsWith('['))) {
    try {
      req.body = JSON.parse(s);
      return next();
    } catch {
      // fall through
    }
  }
  // Otherwise leave req.body as-is (likely {}), continue
  next();
});

/* -----------------------------------------------------------
   4) Debug log – shows what actually reached the route layer
   ----------------------------------------------------------- */
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    if (req.method === 'PATCH') {
      // eslint-disable-next-line no-console
      console.log('PATCH body →', req.headers['content-type'], req.body);
    }
    next();
  });
}

/* -----------------------------------------------------------
   Health + info
   ----------------------------------------------------------- */
app.get('/', (_req, res) => {
  res.status(200).json({ ok: true, service: 'iband-backend' });
});

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

/* -----------------------------------------------------------
   Routes
   ----------------------------------------------------------- */
app.use('/artists', artistRoutes);
app.use('/votes', votesRoutes);
app.use('/safety', safetyRoutes);

/* -----------------------------------------------------------
   Mongo + start
   ----------------------------------------------------------- */
const PORT = process.env.PORT || 10000;
const MONGO_URL =
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