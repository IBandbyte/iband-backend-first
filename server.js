// server.js — iBand Backend Entry
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const artistRoutes = require('./routes/artists');

const app = express();

// -----------------------------------------------------
// ✅ Middleware Setup
// -----------------------------------------------------
app.use(cors());

// ✅ Universal JSON + URL Encoded Parsers
app.use(express.json({ type: ['application/json', 'application/*+json', '*/*'] }));
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
app.get('/', (req, res) => {
  res.json({ ok: true, service: 'iband-backend' });
});

app.use('/artists', artistRoutes);

// -----------------------------------------------------
// MongoDB + Server Init
// -----------------------------------------------------
const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://...'; // replace with your own

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () =>
      console.log(`🚀 Server running on :${PORT}`)
    );
  })
  .catch((err) => console.error('❌ MongoDB connection error:', err));