/* eslint-env node */
const mongoose = require('mongoose');

function isObjectIdLike(id) {
  if (!id || typeof id !== 'string') return false;
  if (mongoose.isValidObjectId && mongoose.isValidObjectId(id)) return true;
  // ultra-safe fallback for ObjectId shape
  return /^[0-9a-fA-F]{24}$/.test(id.trim());
}

module.exports = { isObjectIdLike };