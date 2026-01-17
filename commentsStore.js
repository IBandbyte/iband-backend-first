/**
 * commentsStore.js (ESM — CANONICAL + COMPAT)
 *
 * Canonical comment store with compatibility aliases
 * for existing public + admin routers.
 *
 * Status lifecycle:
 * - pending → approved / rejected
 *
 * Render-safe, in-memory (Phase 1)
 */

import crypto from "crypto";

/* -------------------- Helpers -------------------- */

const nowIso = () => new Date().toISOString();
const toStr = (v) => String(v ?? "").trim();
const isPositiveIntString = (v) => /^\d+$/.test(String(v));

const makeId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const ALLOWED_STATUSES = ["pending", "approved", "rejected"];

function normalizeStatus(s) {
  const v = String(s || "").toLowerCase().trim();
  return ALLOWED_STATUSES.includes(v) ? v : null;
}

/* -------------------- Storage -------------------- */

let comments = [];

/* -------------------- Canonical API -------------------- */

function listAll() {
  return [...comments].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

function getById(id) {
  return comments.find((c) => c.id === toStr(id)) || null;
}

function createComment({ artistId, author, text }) {
  if (!isPositiveIntString(artistId))
    throw new Error("artistId must be numeric");

  if (!toStr(author)) throw new Error("author is required");
  if (!toStr(text)) throw new Error("text is required");

  const comment = {
    id: makeId(),
    artistId: toStr(artistId),
    author: toStr(author),
    text: toStr(text),
    status: "pending",
    flags: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    moderatedAt: null,
    moderatedBy: null,
    moderationNote: null,
  };

  comments.push(comment);
  return comment;
}

function listByArtistId(artistId, { onlyApproved = false } = {}) {
  if (!isPositiveIntString(artistId)) return [];

  return comments
    .filter(
      (c) =>
        c.artistId === toStr(artistId) &&
        (!onlyApproved || c.status === "approved")
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function updateComment(id, patch = {}) {
  const c = getById(id);
  if (!c) return null;

  if (patch.artistId !== undefined) c.artistId = toStr(patch.artistId);
  if (patch.author !== undefined) c.author = toStr(patch.author);
  if (patch.text !== undefined) c.text = toStr(patch.text);

  if (patch.status !== undefined) {
    const s = normalizeStatus(patch.status);
    if (!s) return null;
    c.status = s;
    c.moderatedAt = nowIso();
    c.moderatedBy = toStr(patch.moderatedBy);
    c.moderationNote = toStr(patch.moderationNote);
  }

  c.updatedAt = nowIso();
  return c;
}

function removeComment(id) {
  const idx = comments.findIndex((c) => c.id === toStr(id));
  if (idx === -1) return false;
  comments.splice(idx, 1);
  return true;
}

/* -------------------- Admin helpers -------------------- */

function addFlag(id, { code = "flag", reason = "" } = {}) {
  const c = getById(id);
  if (!c) return null;

  c.flags.push({
    code: toStr(code),
    reason: toStr(reason),
    at: nowIso(),
  });
  c.updatedAt = nowIso();
  return c;
}

function clearFlags(id) {
  const c = getById(id);
  if (!c) return null;
  c.flags = [];
  c.updatedAt = nowIso();
  return c;
}

function bulkRemove(ids = []) {
  const deletedIds = [];
  const notFoundIds = [];

  ids.forEach((id) => {
    const ok = removeComment(id);
    if (ok) deletedIds.push(id);
    else notFoundIds.push(id);
  });

  return { deletedIds, notFoundIds };
}

function bulkSetStatus(ids = [], status, moderatedBy) {
  const s = normalizeStatus(status);
  if (!s) return null;

  const updatedIds = [];
  const notFoundIds = [];

  ids.forEach((id) => {
    const c = getById(id);
    if (!c) return notFoundIds.push(id);

    c.status = s;
    c.moderatedBy = toStr(moderatedBy);
    c.moderatedAt = nowIso();
    c.updatedAt = nowIso();
    updatedIds.push(id);
  });

  return { status: s, updatedIds, notFoundIds };
}

function reset() {
  const count = comments.length;
  comments = [];
  return count;
}

function seed() {
  const before = comments.length;
  comments.push(
    createComment({
      artistId: "1",
      author: "Demo Fan",
      text: "Love this artist 🔥",
    })
  );
  return comments.length - before;
}

/* -------------------- Compatibility Aliases -------------------- */

function getAll() {
  return listAll();
}

function getByArtistId(id) {
  return listByArtistId(id);
}

function update(id, patch) {
  return updateComment(id, patch);
}

function patch(id, patchObj) {
  return updateComment(id, patchObj);
}

/* -------------------- Exports -------------------- */

export {
  listAll,
  getById,
  createComment,
  listByArtistId,
  updateComment,
  removeComment,
};

export default {
  // Canonical
  listAll,
  getById,
  create: createComment,
  listByArtistId,
  updateComment,
  removeComment,

  // Compatibility
  getAll,
  getByArtistId,
  update,
  patch,
  addFlag,
  clearFlags,
  bulkRemove,
  bulkSetStatus,
  reset,
  seed,

  // Debug
  get comments() {
    return comments;
  },
};