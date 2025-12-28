// commentsStore.js
// In-memory comments store (Phase 2.2.1)
// Future-proofed for DB swap later.

import crypto from "crypto";

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  // Works in Node 18+
  if (crypto.randomUUID) return crypto.randomUUID();
  return crypto.randomBytes(16).toString("hex");
}

function cleanText(v, maxLen) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

class CommentsStore {
  constructor() {
    this.byId = new Map(); // commentId -> comment
    this.byArtist = new Map(); // artistId -> [commentId... newest first]
  }

  listByArtistId(artistId, { limit = 50, page = 1 } = {}) {
    const aId = String(artistId ?? "").trim();
    if (!aId) return { items: [], total: 0, page: 1, limit };

    const ids = this.byArtist.get(aId) || [];
    const total = ids.length;

    const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
    const safePage = Math.max(1, Number(page) || 1);
    const start = (safePage - 1) * safeLimit;
    const end = start + safeLimit;

    const items = ids.slice(start, end).map((id) => this.byId.get(id)).filter(Boolean);

    return { items, total, page: safePage, limit: safeLimit };
  }

  add({ artistId, name, text }) {
    const aId = String(artistId ?? "").trim();
    if (!aId) {
      const err = new Error("artistId is required");
      err.status = 400;
      throw err;
    }

    const cleanName = cleanText(name, 60) || "Anonymous";
    const cleanBody = cleanText(text, 500);
    if (!cleanBody) {
      const err = new Error("text is required");
      err.status = 400;
      throw err;
    }

    const id = makeId();
    const comment = {
      id,
      artistId: aId,
      name: cleanName,
      text: cleanBody,
      createdAt: nowIso(),
    };

    this.byId.set(id, comment);

    const arr = this.byArtist.get(aId) || [];
    arr.unshift(id); // newest first
    this.byArtist.set(aId, arr);

    return comment;
  }

  remove(commentId) {
    const id = String(commentId ?? "").trim();
    if (!id) return null;

    const existing = this.byId.get(id);
    if (!existing) return null;

    this.byId.delete(id);

    const aId = existing.artistId;
    const arr = this.byArtist.get(aId) || [];
    const next = arr.filter((x) => x !== id);
    this.byArtist.set(aId, next);

    return existing;
  }

  stats() {
    let total = this.byId.size;
    let artists = this.byArtist.size;
    return { totalComments: total, artistsWithComments: artists };
  }

  // Useful for tests / admin later
  clearAll() {
    this.byId.clear();
    this.byArtist.clear();
  }
}

export const commentsStore = new CommentsStore();