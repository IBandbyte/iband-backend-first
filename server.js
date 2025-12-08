// server.js
// Main iBand backend server – Express + in-memory stores only.

const express = require('express');
const cors = require('cors');

const artistsRouter = require('./artists');
const commentsRouter = require('./comments');
const adminArtistsRouter = require('./adminArtists');
const adminCommentsRouter = require('./adminComments');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// Health / root
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'iBand backend is live 🚀',
  });
});

// Public routes
app.use('/api/artists', artistsRouter);
app.use('/api/comments', commentsRouter);

// Admin routes
app.use('/api/admin/artists', adminArtistsRouter);
app.use('/api/admin/comments', adminCommentsRouter);

// 404 handler (after all routes)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found.',
    path: req.originalUrl,
  });
});

// Global error handler (last)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error.',
  });
});

app.listen(PORT, () => {
  console.log(`iBand backend listening on port ${PORT}`);
});

module.exports = app;