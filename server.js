const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// -----------------------------------------------------
// Middleware
// -----------------------------------------------------
app.use(cors());

// ✅ Universal JSON + URL Encoded Parsers (handles charset + all JSON variants)
app.use(express.json({
  type: [
    'application/json',
    'application/*+json',
    'application/json; charset=utf-8',
    '*/*'
  ]
}));
app.use(express.urlencoded({ extended: true }));

// 🧩 Debug line — log what arrives on PATCH
app.use((req, res, next) => {
  if (req.method === 'PATCH') {
    console.log('PATCH body →', req.headers['content-type'], req.body);
  }
  next();
});

// -----------------------------------------------------
// Routes
// -----------------------------------------------------
const artistRoutes = require('./routes/artists');
app.use('/artists', artistRoutes);

// -----------------------------------------------------
// MongoDB + Server Start
// -----------------------------------------------------
mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://your_connection_string_here')
  .then(() => {
    console.log('✅ MongoDB connected');
    const port = process.env.PORT || 10000;
    app.listen(port, () => console.log(`🚀 Server running on :${port}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));