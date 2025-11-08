// utils/isObjectId.js
/* eslint-env node */

const mongoose = require('mongoose');

/**
 * Safe ObjectId validator that accepts either:
 *  - a valid 24-char hex string
 *  - an existing mongoose.Types.ObjectId
 */
function isObjectId(value) {
  if (!value) return false;
  if (value instanceof mongoose.Types.ObjectId) return true;
  if (typeof value !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(value);
}

module.exports = { isObjectId };