# Contributing (Backend)

## Requirements
- Node 18 (`nvm use` picks from `.nvmrc`)
- MongoDB Atlas URI in `.env` for local dev

## Setup
```bash
npm ci
cp .env.example .env  # fill MONGODB_URI, JWT_SECRET, etc.
npm run dev