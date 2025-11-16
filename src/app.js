// backend/src/app.js
// iBand API Server
// Captain’s Protocol: full file, future-proof, Hoppscotch-ready, no snippets.

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();

// ===================================
// Core Middleware
// ===================================
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ===================================
// Trust Proxy (important for IP checks later for votes, abuse detection)
// ===================================
app.set('trust proxy', true);

// ===================================
// Global Helpers for Standard Responses
// ===================================
app.use((req, res, next) => {
  res.success = (data = null, meta = {}) => {
    return res.json({
      success: true,
      data,
      meta,
    });
  };

  res.fail = (message, code = 'BAD_REQUEST', status = 400, details = null) => {
    return res.status(status).json({
      success: false,
      error: {
        code,
        message,
        details,
      },
    });
  };

  next();
});

// ===================================
// ROUTERS
// ===================================
const commentsRouter = require('./routes/comments');
const votesRouter = require('./routes/votes');

// Hook up all routers
app.use('/api/comments', commentsRouter);
app.use('/api/votes', votesRouter);

// ===================================
// Health Check (for Render, Vercel, CI)
// ===================================
app.get('/health', (req, res) => {
  res.success({ status: 'ok', uptime: process.uptime() });
});

// ===================================
// 404 Handler
// ===================================
app.use((req, res) => {
  res.fail('Route not found.', 'NOT_FOUND', 404);
});

// ===================================
// Global Error Handler
// ===================================
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err);
  res.fail(
    'An unexpected server error occurred.',
    'SERVER_ERROR',
    500,
    err.message
  );
});

module.exports = app;