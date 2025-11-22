// server.js
// iBand backend – main server entrypoint (ROOT level)
//
// Wires up:
//   - MongoDB connection
//   - JSON + CORS middleware
//   - /artists router (full CRUD)
//   - /votes router (fan voting, in-memory for now)

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const artistsRouter = require('./artists');
const votesRouter = require('./votes');

const app = express();

// ---- Global middleware ----
app.use(cors());
app.use(express.json());

// ---- Mongo URI ----
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

// ---- Health check route ----
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'iband-backend',
    mongoUriSet: !!MONGO_URI,
  });
});

// ---- Start server + connect to Mongo ----
async function start() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, { dbName: 'iband' });
    console.log('✅ MongoDB connected');

    // Mount routers AFTER DB is ready
    app.use('/artists', artistsRouter);
    app.use('/votes', votesRouter);

    const port = process.env.PORT || 10000;
    app.listen(port, () => {
      console.log(`🚀 Server running on :${port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();