/**
 * commentsStore.js (ESM)
 *
 * Persistent, disk-aware comments store (Render Disk compatible).
 * Used by:
 * - public comments routes (comments.js)
 * - admin moderation routes (adminComments.js)
 *
 * Storage strategy:
 * - If Render Persistent Disk mounted at /var/data:
 *   -> store at /var/data/iband/db/comments.json
 * - Otherwise fallback to local ./db/comments.json (ephemeral)
 *
 * Canonical statuses:
 * - pending | approved | hidden | rejected
 *
 * Supports both modern + legacy aliases to avoid router breakage.
 */

import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

/* -------------------- Helpers -------------------- */

const nowIso = () => new Date().toISOString();
const safeText = (v) => (v === null || v === undefined ? "" : String(v)).trim();
const ensureArray = (v) => (Array.isArray(v) ? v : []);

const CANONICAL_STATUSES = ["pending", "approved", "hidden", "rejected"];

const normalizeStatus = (s) => {
  const v = safeText(s).toLowerCase();
  return CANONICAL_STATUSES.includes(v) ? v : "pending";
};

function dirWritable(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    fs.accessSync(dirPath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/* -------------------- Storage location (Disk-aware) -------------------- */

const ROOT = process.cwd();

const DISK_MOUNT = "/var/data";
const DISK_BASE = path.join(DISK_MOUNT, "iband", "db");
const LOCAL_BASE = path.join(ROOT, "db");

const USE_DISK = dirWritable(DISK_BASE);
const DB_DIR = USE_DISK ? DISK_BASE : LOCAL_BASE;
const DB_FILE = path.join(DB_DIR, "comments.json");

const STORAGE_META = {
  mode: USE_DISK ? "render-disk" : "ephemeral-local",
  dbDir: DB_DIR,
  dbFile: DB_FILE,
  note: USE_DISK
    ? "Persistent Disk detected (/var/data). Data should survive redeploys."
    : "No Persistent Disk detected. Data may reset on redeploy/restart (free Render behavior).",
};

/* -------------------- In-memory state -------------------- */

let comments = [];

/* -------------------- Normalization -------------------- */

function normalizeFlag(f = {}) {
  return {
    code: safeText(f.code || "flag"),
    reason: safeText(f.reason || ""),
    at: safeText(f.at || nowIso()),
  };
}

function normalizeComment(raw = {}) {
  const flags = ensureArray(raw.flags);

  return {
    id: safeText(raw.id) || randomUUID(),
    artistId: safeText(raw.artistId),
    author: safeText(raw.author || "anon"),
    text: safeText(raw.text || "").slice(0, 2000),
    status: normalizeStatus(raw.status),
    flags: flags.map(normalizeFlag),

    createdAt: safeText(raw.createdAt || nowIso()),
    updatedAt: safeText(raw.updatedAt || nowIso()),

    moderatedAt: raw.moderatedAt === null ? null : safeText(raw.moderatedAt || null),
    moderatedBy: raw.moderatedBy === null ? null : safeText(raw.moderatedBy || null),
    moderationNote: raw.moderationNote === null ? null : safeText(raw.moderationNote || null),
  };
}

/* -------------------- Disk I/O (atomic write) -------------------- */

function loadFromDisk() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      comments = [];
      return;
    }
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const list = ensureArray(parsed?.data || parsed);
    comments = list.map(normalizeComment);
  } catch {
    comments = [];
  }
}

function saveToDisk() {
  try {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

    const payload = JSON.stringify({ updatedAt: nowIso(), data: comments }, null, 2);
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, payload, "utf8");
    fs.renameSync(tmp, DB_FILE);
    return true;
  } catch {
    return false;
  }
}

loadFromDisk();

/* -------------------- Core API -------------------- */

export function listAdmin({ status, artistId, flagged } = {}) {
  let arr = ensureArray(comments);

  if (artistId) {
    const a = safeText(artistId);
    arr = arr.filter((c) => safeText(c.artistId) === a);
  }

  if (status) {
    const s = normalizeStatus(status);
    arr = arr.filter((c) => safeText(c.status).toLowerCase() === s);
  }

  if (flagged) {
    arr = arr.filter((c) => Array.isArray(c.flags) && c.flags.length > 0);
  }

  arr = arr
    .slice()
    .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt));

  return { ok: true, count: arr.length, comments: arr };
}

export function listPublic({ artistId, limit = 50, offset = 0 } = {}) {
  const a = safeText(artistId);
  let arr = ensureArray(comments);

  if (a) arr = arr.filter((c) => safeText(c.artistId) === a);

  // Public only sees approved by default
  arr = arr.filter((c) => safeText(c.status).toLowerCase() === "approved");

  arr = arr
    .slice()
    .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt));

  const off = Math.max(0, Number(offset) || 0);
  const lim = Math.min(200, Math.max(1, Number(limit) || 50));

  return {
    ok: true,
    count: Math.max(0, arr.length - off),
    comments: arr.slice(off, off + lim),
    artistId: a,
    limit: lim,
    offset: off,
  };
}

export function getById(id) {
  const clean = safeText(id);
  if (!clean) return null;
  return comments.find((c) => c.id === clean) || null;
}

export function create({ artistId, author, text }) {
  const a = safeText(artistId);
  const au = safeText(author || "anon");
  const t = safeText(text);

  if (!a) return { ok: false, status: 400, message: "artistId is required." };
  if (!t) return { ok: false, status: 400, message: "text is required." };

  const rec = normalizeComment({
    id: randomUUID(),
    artistId: a,
    author: au,
    text: t,
    status: "pending",
    flags: [],
    moderatedAt: null,
    moderatedBy: null,
    moderationNote: null,
  });

  rec.createdAt = nowIso();
  rec.updatedAt = nowIso();

  comments.unshift(rec);
  saveToDisk();

  return { ok: true, comment: rec };
}

export function patch(id, patchObj = {}) {
  const clean = safeText(id);
  const idx = comments.findIndex((c) => c.id === clean);
  if (idx === -1) return null;

  const existing = comments[idx];

  const next = normalizeComment({
    ...existing,
    ...patchObj,
    id: existing.id,
    flags:
      patchObj.flags !== undefined
        ? ensureArray(patchObj.flags).map(normalizeFlag)
        : existing.flags,
  });

  // moderation timestamps if status changed or moderation fields provided
  const statusChanged =
    patchObj.status !== undefined &&
    normalizeStatus(patchObj.status) !== safeText(existing.status).toLowerCase();

  const moderationTouched =
    patchObj.moderatedBy !== undefined ||
    patchObj.moderationNote !== undefined ||
    patchObj.status !== undefined;

  if (statusChanged || moderationTouched) {
    next.moderatedAt = nowIso();
    if (patchObj.moderatedBy !== undefined) next.moderatedBy = safeText(patchObj.moderatedBy) || null;
    if (patchObj.moderationNote !== undefined) next.moderationNote = safeText(patchObj.moderationNote) || "";
  }

  next.updatedAt = nowIso();

  comments[idx] = next;
  saveToDisk();

  return next;
}

export function remove(id) {
  const clean = safeText(id);
  const idx = comments.findIndex((c) => c.id === clean);
  if (idx === -1) return false;

  comments.splice(idx, 1);
  saveToDisk();
  return true;
}

export function addFlag(id, { code, reason } = {}) {
  const existing = getById(id);
  if (!existing) return null;

  const flags = ensureArray(existing.flags).slice();
  flags.push(normalizeFlag({ code, reason }));

  return patch(existing.id, { flags });
}

export function clearFlags(id) {
  const existing = getById(id);
  if (!existing) return null;
  return patch(existing.id, { flags: [] });
}

export function bulkUpdateStatus({ ids, status, moderatedBy, moderationNote } = {}) {
  const list = ensureArray(ids).map(safeText).filter(Boolean);
  if (!list.length) return { ok: false, status: 400, message: "ids is required." };

  const s = normalizeStatus(status);
  const updatedIds = [];
  const notFoundIds = [];

  for (const id of list) {
    const existing = getById(id);
    if (!existing) {
      notFoundIds.push(id);
      continue;
    }
    const updated = patch(id, {
      status: s,
      moderatedBy: moderatedBy ?? existing.moderatedBy ?? null,
      moderationNote: moderationNote ?? existing.moderationNote ?? "",
    });
    if (updated) updatedIds.push(id);
  }

  return {
    ok: true,
    status: s,
    updated: updatedIds.length,
    updatedIds,
    notFoundIds,
  };
}

export function bulkRemove(ids = []) {
  const list = ensureArray(ids).map(safeText).filter(Boolean);
  const deletedIds = [];
  const notFoundIds = [];

  for (const id of list) {
    const ok = remove(id);
    if (ok) deletedIds.push(id);
    else notFoundIds.push(id);
  }

  return { deletedIds, notFoundIds };
}

export function reset() {
  const deleted = comments.length;
  comments = [];
  saveToDisk();
  return deleted;
}

export function seed() {
  const before = comments.length;

  const demo = [
    {
      artistId: "demo",
      author: "iBand System",
      text: "Welcome to iBand — fans decide who rises. 🔥",
      status: "approved",
      moderatedBy: "system",
      moderationNote: "seed",
    },
  ];

  for (const c of demo) {
    const created = create(c);
    if (created?.ok) {
      patch(created.comment.id, {
        status: "approved",
        moderatedBy: "system",
        moderationNote: "seed",
      });
    }
  }

  return comments.length - before;
}

/* -------------------- Aliases (back-compat) -------------------- */

function listAll() {
  return { ok: true, count: comments.length, comments: ensureArray(comments) };
}
function getAll() {
  return ensureArray(comments);
}

/* -------------------- Default export -------------------- */

export default {
  storage: STORAGE_META,

  // canonical
  listAdmin,
  listPublic,
  getById,
  create,
  patch,
  remove,
  addFlag,
  clearFlags,
  bulkUpdateStatus,
  bulkRemove,
  reset,
  seed,

  // aliases
  listAll,
  getAll,

  // debug
  save: saveToDisk,
  get comments() {
    return comments;
  },
};