// rooms.js (ESM) — Phase H5.2 Community Rooms Foundation
// Stores:
// - rooms.json (room registry)
// - events/rooms-events.jsonl (create/join/leave/post events)
// - messages/room-messages.jsonl (messages)
// Future-ready for ambassador-only forums, artist-invite rooms, translation hooks, and moderation integration.

import express from "express";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICE = "rooms";
const PHASE = "H5.2";
const VERSION = 1;

const DB_ROOT = process.env.IBAND_DATA_DIR || "/var/data/iband/db";
const STORAGE_DIR = path.join(DB_ROOT, "rooms");
const ROOMS_FILE = path.join(STORAGE_DIR, "rooms.json");
const EVENTS_DIR = path.join(STORAGE_DIR, "events");
const MESSAGES_DIR = path.join(STORAGE_DIR, "messages");
const EVENTS_FILE = path.join(EVENTS_DIR, "rooms-events.jsonl");
const MESSAGES_FILE = path.join(MESSAGES_DIR, "room-messages.jsonl");

const LIMITS = {
  maxBodyBytes: 25000,
  maxReadBytes: 20 * 1024 * 1024,
  maxLineScan: 180000,
  maxRoomsReturned: 50,
  maxMessagesReturned: 50,
  maxTextLen: 1500,
};

const DEDUPE = {
  // prevent spam/dupe posts/join bursts from same fan+room+action
  windowMs: 5 * 60 * 1000,
};

const DEFAULTS = {
  roomType: "community", // community | ambassador | artist | genre | country | event
  visibility: "public", // public | unlisted | private
  status: "active", // active | archived | frozen
};

// --- minimal moderation wordlists (fallback).
// Real moderation should rely on moderation.js (Phase H5.1). We integrate opportunistically.
const BAD_LANGUAGE = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "wanker",
  "twat",
  "pussy",
  "dick",
  "motherfucker",
];
const SEXUAL_TEXT = [
  "nudes",
  "send nudes",
  "onlyfans",
  "sex",
  "sext",
  "porn",
  "blowjob",
  "fuck me",
];

// ---------- helpers ----------
function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  return crypto.randomBytes(12).toString("hex");
}

function safeStr(v, max = 300) {
  const s = (v ?? "").toString().trim();
  return s.length > max ? s.slice(0, max) : s;
}

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

async function ensureDirs() {
  await fsp.mkdir(STORAGE_DIR, { recursive: true });
  await fsp.mkdir(EVENTS_DIR, { recursive: true });
  await fsp.mkdir(MESSAGES_DIR, { recursive: true });
  if (!fs.existsSync(ROOMS_FILE)) {
    await fsp.writeFile(ROOMS_FILE, JSON.stringify({ version: 1, updatedAt: nowIso(), rooms: [] }, null, 2));
  }
}

async function readRoomsStore() {
  await ensureDirs();
  const raw = await fsp.readFile(ROOMS_FILE, "utf8");
  const store = JSON.parse(raw || "{}");
  if (!store.rooms || !Array.isArray(store.rooms)) {
    return { version: 1, updatedAt: nowIso(), rooms: [] };
  }
  return store;
}

async function writeRoomsStore(store) {
  store.updatedAt = nowIso();
  await fsp.writeFile(ROOMS_FILE, JSON.stringify(store, null, 2));
}

async function appendJsonl(filePath, obj) {
  const line = JSON.stringify(obj) + "\n";
  await ensureDirs();
  await fsp.appendFile(filePath, line, "utf8");
}

function containsAny(text, list) {
  const t = (text || "").toLowerCase();
  return list.some((w) => t.includes(w));
}

function localContentCheck(text) {
  if (!text || typeof text !== "string") return { ok: true };
  const cleaned = text.toLowerCase();

  if (containsAny(cleaned, SEXUAL_TEXT)) {
    return { ok: false, reasonCode: "sexual_text", severity: 2 };
  }
  if (containsAny(cleaned, BAD_LANGUAGE)) {
    return { ok: false, reasonCode: "bad_language", severity: 1 };
  }
  return { ok: true };
}

async function maybeRecordStrike({ fanId, scopeKey = "global", reasonCode, severity = 1 }) {
  // Try to use moderation.js if it exports a recorder. If not, we do nothing (rooms remains usable).
  try {
    const modPath = path.resolve(__dirname, "./moderation.js");
    if (!fs.existsSync(modPath)) return { ok: false, reason: "moderation_missing" };

    const mod = await import(modPath.startsWith("file:") ? modPath : `file://${modPath}`);
    const fn =
      mod?.recordStrikeInternal ||
      mod?.recordStrike ||
      mod?.issueStrike ||
      null;

    if (typeof fn !== "function") return { ok: false, reason: "moderation_no_export" };

    const res = await fn({
      fanId,
      scopeKey,
      reasonCode,
      severity,
      createdBy: "system",
    });

    return { ok: true, result: res };
  } catch (err) {
    return { ok: false, reason: "moderation_error", err: String(err?.message || err) };
  }
}

function ok(res, payload) {
  res.status(200).json(payload);
}

function bad(res, status, error, extra = {}) {
  res.status(status).json({ success: false, error, ...extra });
}

// ---------- routes ----------

// Health
router.get("/health", async (req, res) => {
  await ensureDirs();

  const roomsStore = await readRoomsStore();
  const eventsOk = fs.existsSync(EVENTS_FILE);
  const msgsOk = fs.existsSync(MESSAGES_FILE);

  ok(res, {
    success: true,
    service: SERVICE,
    phase: PHASE,
    version: VERSION,
    storageDir: STORAGE_DIR,
    files: {
      rooms: {
        path: ROOMS_FILE,
        ok: true,
        size: fs.statSync(ROOMS_FILE).size,
        mtimeMs: fs.statSync(ROOMS_FILE).mtimeMs,
      },
      events: {
        path: EVENTS_FILE,
        ok: eventsOk,
        size: eventsOk ? fs.statSync(EVENTS_FILE).size : 0,
        mtimeMs: eventsOk ? fs.statSync(EVENTS_FILE).mtimeMs : null,
      },
      messages: {
        path: MESSAGES_FILE,
        ok: msgsOk,
        size: msgsOk ? fs.statSync(MESSAGES_FILE).size : 0,
        mtimeMs: msgsOk ? fs.statSync(MESSAGES_FILE).mtimeMs : null,
      },
    },
    store: {
      rooms: roomsStore.rooms.length,
      updatedAt: roomsStore.updatedAt,
    },
    limits: LIMITS,
    dedupe: DEDUPE,
    ts: nowIso(),
  });
});

// Create room
router.post("/create", async (req, res) => {
  const body = req.body || {};

  const name = safeStr(body.name, 80);
  if (!name) return bad(res, 400, "invalid_room_name");

  const type = safeStr(body.type || DEFAULTS.roomType, 30);
  const visibility = safeStr(body.visibility || DEFAULTS.visibility, 30);
  const status = safeStr(body.status || DEFAULTS.status, 30);

  const createdByFanId = safeStr(body.createdByFanId, 80);
  const artistId = safeStr(body.artistId, 80) || null;

  // future: ambassador-only / verified checks live here
  const ambassadorOnly = Boolean(body.ambassadorOnly || false);

  const tags = Array.isArray(body.tags) ? body.tags.map((t) => safeStr(t, 24)).filter(Boolean).slice(0, 12) : [];

  const description = safeStr(body.description, 240);

  const room = {
    id: body.id ? safeStr(body.id, 64) : `room_${makeId()}`,
    name,
    description,
    type,
    visibility,
    status,
    ambassadorOnly,
    tags,
    artistId,
    createdByFanId: createdByFanId || null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    counters: {
      joins: 0,
      messages: 0,
    },
  };

  const store = await readRoomsStore();
  const exists = store.rooms.find((r) => r.id === room.id);
  if (exists) return bad(res, 409, "room_exists", { id: room.id });

  store.rooms.unshift(room);
  await writeRoomsStore(store);

  await appendJsonl(EVENTS_FILE, {
    id: makeId(),
    type: "room_create",
    roomId: room.id,
    createdByFanId: room.createdByFanId,
    artistId: room.artistId,
    ts: room.createdAt,
    meta: body.meta || null,
  });

  ok(res, { success: true, message: "Room created.", room });
});

// List rooms (filters)
router.get("/list", async (req, res) => {
  const store = await readRoomsStore();

  const type = safeStr(req.query.type, 30);
  const visibility = safeStr(req.query.visibility, 30);
  const artistId = safeStr(req.query.artistId, 80);
  const tag = safeStr(req.query.tag, 24);

  const limit = clampInt(req.query.limit, 1, LIMITS.maxRoomsReturned, 20);

  let rooms = store.rooms.slice();

  if (type) rooms = rooms.filter((r) => (r.type || "") === type);
  if (visibility) rooms = rooms.filter((r) => (r.visibility || "") === visibility);
  if (artistId) rooms = rooms.filter((r) => (r.artistId || "") === artistId);
  if (tag) rooms = rooms.filter((r) => Array.isArray(r.tags) && r.tags.includes(tag));

  // basic ordering: newest updated first
  rooms.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

  ok(res, {
    success: true,
    rooms: rooms.slice(0, limit),
    meta: {
      total: rooms.length,
      limit,
      ts: nowIso(),
    },
  });
});

// Get room by id
router.get("/:roomId", async (req, res) => {
  const roomId = safeStr(req.params.roomId, 80);
  const store = await readRoomsStore();
  const room = store.rooms.find((r) => r.id === roomId);
  if (!room) return bad(res, 404, "room_not_found", { roomId });

  ok(res, { success: true, room, ts: nowIso() });
});

// Join room (records event)
router.post("/join", async (req, res) => {
  const body = req.body || {};
  const roomId = safeStr(body.roomId, 80);
  const fanId = safeStr(body.fanId, 80);
  if (!roomId) return bad(res, 400, "missing_roomId");
  if (!fanId) return bad(res, 400, "missing_fanId");

  const store = await readRoomsStore();
  const room = store.rooms.find((r) => r.id === roomId);
  if (!room) return bad(res, 404, "room_not_found", { roomId });

  // Ambassador-only enforcement (future-ready)
  if (room.ambassadorOnly && !body.ambassador) {
    return bad(res, 403, "ambassador_required", { roomId });
  }

  room.counters = room.counters || { joins: 0, messages: 0 };
  room.counters.joins = (room.counters.joins || 0) + 1;
  room.updatedAt = nowIso();
  await writeRoomsStore(store);

  await appendJsonl(EVENTS_FILE, {
    id: makeId(),
    type: "room_join",
    roomId,
    fanId,
    ts: nowIso(),
    meta: body.meta || null,
  });

  ok(res, { success: true, message: "Joined room.", roomId, fanId, ts: nowIso() });
});

// Post message (moderation-aware)
router.post("/post", async (req, res) => {
  const body = req.body || {};
  const roomId = safeStr(body.roomId, 80);
  const fanId = safeStr(body.fanId, 80);
  const text = (body.text ?? "").toString();
  const lang = safeStr(body.lang || body.locale || "en", 12);

  if (!roomId) return bad(res, 400, "missing_roomId");
  if (!fanId) return bad(res, 400, "missing_fanId");
  if (!text.trim()) return bad(res, 400, "missing_text");
  if (text.length > LIMITS.maxTextLen) return bad(res, 413, "text_too_long", { maxTextLen: LIMITS.maxTextLen });

  const store = await readRoomsStore();
  const room = store.rooms.find((r) => r.id === roomId);
  if (!room) return bad(res, 404, "room_not_found", { roomId });

  // Local content check (fallback)
  const check = localContentCheck(text);
  if (!check.ok) {
    // Optional: record strike via moderation module if available
    await maybeRecordStrike({
      fanId,
      scopeKey: body.scopeKey || "global",
      reasonCode: check.reasonCode,
      severity: check.severity || 1,
    });

    return bad(res, 403, "blocked_by_policy", {
      reasonCode: check.reasonCode,
      message: "Message blocked by community policy.",
    });
  }

  const msg = {
    id: `msg_${makeId()}`,
    roomId,
    fanId,
    artistId: safeStr(body.artistId, 80) || null,
    text: text.trim(),
    lang,
    ts: nowIso(),
    meta: body.meta || null,
  };

  await appendJsonl(MESSAGES_FILE, msg);

  room.counters = room.counters || { joins: 0, messages: 0 };
  room.counters.messages = (room.counters.messages || 0) + 1;
  room.updatedAt = nowIso();
  await writeRoomsStore(store);

  await appendJsonl(EVENTS_FILE, {
    id: makeId(),
    type: "room_post",
    roomId,
    fanId,
    messageId: msg.id,
    ts: msg.ts,
    meta: body.meta || null,
  });

  ok(res, { success: true, message: "Message posted.", msg });
});

// List messages (basic tail read via JSONL scan)
router.get("/:roomId/messages", async (req, res) => {
  const roomId = safeStr(req.params.roomId, 80);
  const limit = clampInt(req.query.limit, 1, LIMITS.maxMessagesReturned, 20);

  if (!fs.existsSync(MESSAGES_FILE)) {
    return ok(res, { success: true, roomId, messages: [], meta: { limit, ts: nowIso() } });
  }

  // Simple scan (safe for current scale); later we’ll index by roomId for speed
  const raw = await fsp.readFile(MESSAGES_FILE, "utf8");
  const lines = raw.split("\n").filter(Boolean);

  const msgs = [];
  for (let i = lines.length - 1; i >= 0 && msgs.length < limit; i -= 1) {
    try {
      const obj = JSON.parse(lines[i]);
      if (obj.roomId === roomId) msgs.push(obj);
    } catch (_) {
      // ignore bad line
    }
  }

  msgs.reverse();
  ok(res, { success: true, roomId, messages: msgs, meta: { limit, ts: nowIso() } });
});

export default router;