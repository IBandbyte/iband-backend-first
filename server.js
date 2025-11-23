// server.js
// iBand backend — main server entrypoint (root-based)
//
// Wires up:
//   - MongoDB connection
//   - JSON + CORS middleware
//   - /artists router (full CRUD)
//   - /votes router (in-memory vote service)
//   - /comments router (Mongo-backed threads)

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// ✅ Use the root routers (artists.js, votes.js, comments.js)
const artistsRouter = require('./artists');
const votesRouter = require('./votes');
const commentsRouter = require('./comments');

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

// ---- Attach routers ----
function attachRouters() {
  // Artists CRUD (already working with Hoppscotch)
  app.use('/artists', artistsRouter);

  // Votes (in-memory service, already tested)
  app.use('/votes', votesRouter);

  // NEW: Comments (Mongo-backed, threaded)
  // Full paths will look like:
  //   POST   /comments
  //   GET    /comments
  //   GET    /comments/:id
  //   PATCH  /comments/:id
  //   DELETE /comments/:id
  //   POST   /comments/:id/replies
  //   GET    /comments/:id/replies
  //   POST   /comments/:id/like
  //   POST   /comments/:id/unlike
  //   POST   /comments/:id/report
  //   PATCH  /comments/:id/moderate
  app.use('/comments', commentsRouter);
}

// ---- Start server ----
async function start() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, { dbName: 'iband' });
    console.log('✅ MongoDB connected');

    attachRouters();

    const port = process.env.PORT || 10000;
    app.listen(port, () => {
      console.log(`🚀 Server running on :${port}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();