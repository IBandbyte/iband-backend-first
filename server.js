const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// -----------------------------------------------------
// Middleware
// -----------------------------------------------------
app.use(cors());

// ✅ Universal JSON + URL Encoded Parsers (handles charset + mobile variants)
app.use(
  express.json({
    type: [
      'application/json',
      'application/*+json',
      'application/json; charset=utf-8',
      '*/*'
    ]
  })
);
app.use(express.urlencoded({ extended: true }));

// 🧩 Debug logger (ESLint-safe for development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    if (req.method === 'PATCH') {
      // eslint-disable-next-line no-console
      console.log('PATCH body →', req.headers['content-type'], req.body);
    }
    next();
  });
}

// -----------------------------------------------------
// Routes
// -----------------------------------------------------
const artistRoutes = require('./routes/artists');
app.use('/artists', artistRoutes);

// -----------------------------------------------------
// MongoDB + Server Start
// -----------------------------------------------------
mongoose
  .connect(process.env.MONGO_URI || 'mongodb+srv://your_connection_string_here')
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('✅ MongoDB connected');
    const port = process.env.PORT || 10000;
    // eslint-disable-next-line no-console
    app.listen(port, () => console.log(`🚀 Server running on :${port}`));
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('MongoDB connection error:', err);
  });