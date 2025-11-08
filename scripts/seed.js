/* eslint-env node */

// scripts/seed.js — quick seeder for local/dev/Render (Run: `npm run seed`)
// It will NOT overwrite existing artists with the same name.

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO ||
  'mongodb://127.0.0.1:27017/iband';

const Artist =
  mongoose.models.Artist ||
  mongoose.model(
    'Artist',
    new mongoose.Schema(
      {
        name: { type: String, required: true, unique: true },
        genre: { type: String, default: '' },
        votes: { type: Number, default: 0 },
        commentsCount: { type: Number, default: 0 },
      },
      { collection: 'artists', timestamps: false }
    )
  );

async function main() {
  await mongoose.connect(MONGO);
  console.log('✅ Connected to Mongo');

  const seed = [
    { name: 'Aria Nova', genre: 'Pop', votes: 12, commentsCount: 3 },
    { name: 'Bad Bunny', genre: 'Latin trap' },
    { name: 'Billie Eilish', genre: 'Alt pop' },
    { name: 'Drake', genre: 'Hip hop' },
    { name: 'Neon Harbor', genre: 'Synthwave', votes: 8, commentsCount: 1 },
    { name: 'Stone & Sparrow', genre: 'Indie Folk', votes: 20, commentsCount: 5 },
  ];

  for (const a of seed) {
    const exists = await Artist.findOne({ name: a.name }).lean();
    if (exists) {
      console.log(`↩︎ Skipped (exists): ${a.name}`);
      continue;
    }
    await Artist.create(a);
    console.log(`＋ Inserted: ${a.name}`);
  }

  await mongoose.disconnect();
  console.log('✅ Seed complete. Bye.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});