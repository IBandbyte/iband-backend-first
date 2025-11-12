// src/server.js
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function start() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI, { dbName: 'iband' });
  console.log('✅ MongoDB connected');

  const { router: artistsRouter } = require('./artists');
  app.use('/artists', artistsRouter);

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'iband-backend', mongoUriSet: !!MONGO_URI });
  });

  const port = process.env.PORT || 10000;
  app.listen(port, () => {
    console.log(`🚀 Server running on :${port}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});