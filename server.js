// server.js (root)
// iBand - Main server entry point

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// -----------------------------------------
// Import Routers (all inside /src)
// -----------------------------------------
const artistRoutes = require('./src/artistRoutes');
const voteRoutes = require('./src/votes');
const commentRoutes = require('./src/comments');
const adminRoutes = require('./src/admin');

const app = express();

// -----------------------------------------
// Middleware
// -----------------------------------------
app.use(cors());
app.use(express.json());

// -----------------------------------------
// API Routes (Public)
// -----------------------------------------
app.use('/artists', artistRoutes);
app.use('/votes', voteRoutes);
app.use('/comments', commentRoutes);

// -----------------------------------------
// API Routes (Admin - Protected via x-admin-secret)
// -----------------------------------------
app.use('/admin', adminRoutes);

// -----------------------------------------
// Root endpoint
// -----------------------------------------
app.get('/', (_req, res) => {
  res.json({ message: 'iBand Backend API is running.' });
});

// -----------------------------------------
// Database Connection & Server Start
// -----------------------------------------
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || '';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });