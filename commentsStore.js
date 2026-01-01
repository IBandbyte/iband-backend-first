/**
 * commentsStore.js (ESM)
 * Single source of truth for comment persistence.
 *
 * Supports:
 * - listComments({ artistId })
 * - getComment(id)
 * - createComment({ artistId, name, text })
 * - deleteComment(id)
 * - save()
 *
 * Storage:
 * - db/comments.json (if writable) + in-memory fallback
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

function nowIso() {
  return new Date().toISOString();
}

function safeText(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function clampText(v, max = 2000) {
  const s = safeText(v).trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max) : s;
}

function makeId() {
  return crypto.randomUUID();
}

function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

function normalizeComment(raw) {
  const c = raw || {};
  const id = safeText(c.id || c._id || "").trim() || makeId();

  return {
    id,
    artistId: safeText(c.artistId || "").trim(),
    name: clampText(c.name || "Anonymous", 80) || "Anonymous",
    text: clampText(c.text || "", 2000),
    createdAt: isNonEmptyString(c.createdAt) ? c.createdAt : nowIso(),
    updatedAt: isNonEmptyString(c.updatedAt) ? c.updatedAt : nowIso(),
  };
}

const ROOT = process.cwd();
const DB_DIR = path.join(ROOT, "db");
const DB_FILE = path.join(DB_DIR, "comments.json");

// In-memory store
let comments = [];

function loadFromDisk() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      comments = [];
      return;
    }
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const list = ensureArray(parsed?.data || parsed?.comments || parsed);
    comments = list.map(normalizeComment);
  } catch {
    comments = [];
  }
}

function saveToDisk() {
  try {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    const payload = { updatedAt: nowIso(), data: comments };
    fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), "utf8");
    return true;
  } catch {
    // Render disk can be ephemeral; keep in-memory working regardless
    return false;
  }
}

// Load once
loadFromDisk();

/** PUBLIC API **/

export function listComments({ artistId } = {}) {
  const aId = safeText(artistId).trim();
  const list = ensureArray(comments);

  if (!aId) return list;

  return list.filter((c) => safeText(c.artistId).trim() === aId);
}

export function getComment(id) {
  const cId = safeText(id).trim();
  if (!cId) return null;
  return comments.find((c) => safeText(c.id).trim() === cId) || null;
}

export function createComment({ artistId, name, text } = {}) {
  const aId = safeText(artistId).trim();
  const t = clampText(text, 2000);

  if (!aId) {
    return { error: "artistId is required" };
  }
  if (!t) {
    return { error: "text is required" };
  }

  const c = normalizeComment({
    id: makeId(),
    artistId: aId,
    name: clampText(name || "Anonymous", 80) || "Anonymous",
    text: t,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  comments.unshift(c);
  saveToDisk();
  return c;
}

export function deleteComment(id) {
  const cId = safeText(id).trim();
  if (!cId) return false;

  const idx = comments.findIndex((c) => safeText(c.id).trim() === cId);
  if (idx === -1) return false;

  comments.splice(idx, 1);
  saveToDisk();
  return true;
}

export function save() {
  return saveToDisk();
}

// Optional default export for compatibility
export default {
  listComments,
  getComment,
  createComment,
  deleteComment,
  save,
  get comments() {
    return comments;
  },
};