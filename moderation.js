/**
 * moderation.js
 * ---------------------------------------
 * Phase H5.1 – Access Control + Strikes Engine
 *
 * Storage (Render persistent disk):
 * - /var/data/iband/db/moderation/strikes.jsonl
 * - /var/data/iband/db/moderation/bans.jsonl
 *
 * Endpoints:
 * - GET  /api/moderation/health
 * - GET  /api/moderation/status/fan/:fanId?scope=global&artistId=&roomId=
 * - POST /api/moderation/strike
 * - POST /api/moderation/unban
 */

import express from "express";
import crypto from "crypto";
import fsp from "fs/promises";
import path from "path";

const router = express.Router();

const DATA_DIR = process.env.IBAND_DATA_DIR || "/var/data/iband/db";
const MOD_DIR = path.join(DATA_DIR, "moderation");
const STRIKES_FILE = path.join(MOD_DIR, "strikes.jsonl");
const BANS_FILE = path.join(MOD_DIR, "bans.jsonl");

const LIMITS = {
  maxBodyBytes: 25_000,
  maxReadBytes: 20 * 1024 * 1024,
  maxLineScan: 180_000
};

// Policy defaults (future-proof)
const POLICY = {
  strikeWindowDays: 180, // rolling window for 3-strike rule
  autoSuspendHours: 24,  // 24h extraction for any strike
  banOnStrikes: 3,
  banDays: 180,          // 6 months
  dedupeWindowMs: 5 * 60 * 1000 // 5 minutes
};

const ALLOWED_SCOPES = new Set(["global", "artist", "forum", "room"]);

function nowIso() {
  return new Date().toISOString();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

async function ensureDirs() {
  await fsp.mkdir(MOD_DIR, { recursive: true });
}

function safeJson(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function bodyBytes(body) {
  try {
    return Buffer.byteLength(JSON.stringify(body || {}), "utf8");
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

async function readJsonlLines(filePath, maxBytes) {
  await ensureDirs();
  try {
    const stat = await fsp.stat(filePath);
    if (stat.size > maxBytes) {
      const fd = await fsp.open(filePath, "r");
      try {
        const start = Math.max(0, stat.size - maxBytes);
        const len = stat.size - start;
        const buf = Buffer.alloc(len);
        await fd.read(buf, 0, len, start);
        return buf.toString("utf8").split("\n").filter(Boolean);
      } finally {
        await fd.close();
      }
    }
    const raw = await fsp.readFile(filePath, "utf8");
    return raw.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

async function appendJsonl(filePath, obj) {
  await ensureDirs();
  await fsp.appendFile(filePath, JSON.stringify(obj) + "\n", "utf8");
}

function withinLookback(tsIso, days) {
  const t = new Date(tsIso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= days * 86400000;
}

function normalizeScope(input) {
  const s = (input || "global").toString().trim().toLowerCase();
  return ALLOWED_SCOPES.has(s) ? s : "global";
}

function scopeKey({ scope, artistId, roomId }) {
  const s = normalizeScope(scope);
  if (s === "artist") return `artist:${(artistId || "").toString().trim() || "unknown"}`;
  if (s === "room") return `room:${(roomId || "").toString().trim() || "unknown"}`;
  if (s === "forum") return `forum:${(artistId || "").toString().trim() || "general"}`;
  return "global";
}

function parseUntil(untilIso) {
  const t = new Date(untilIso).getTime();
  return Number.isFinite(t) ? t : null;
}

function addHours(tsIso, hours) {
  const t = new Date(tsIso).getTime();
  const base = Number.isFinite(t) ? t : Date.now();
  return new Date(base + hours * 3600000).toISOString();
}

function addDays(tsIso, days) {
  const t = new Date(tsIso).getTime();
  const base = Number.isFinite(t) ? t : Date.now();
  return new Date(base + days * 86400000).toISOString();
}

function isActiveBan(ban, nowMs) {
  const untilMs = parseUntil(ban.until);
  if (!untilMs) return false;
  return nowMs < untilMs && ban.active !== false;
}

function normalizeStrikeBody(body) {
  const ts = nowIso();
  const fanId = (body.fanId || "").toString().trim();
  const artistId = (body.artistId || "").toString().trim();
  const roomId = (body.roomId || "").toString().trim();

  const scope = normalizeScope(body.scope);
  const key = scopeKey({ scope, artistId, roomId });

  const reasonCode = (body.reasonCode || "unspecified").toString().trim().toLowerCase();
  const message = (body.message || "").toString().trim();
  const evidence = (body.evidence || body.meta?.evidence || "").toString().trim();
  const createdBy = (body.createdBy || "system").toString().trim();
  const severity = clamp(Number(body.severity) || 1, 1, 3);

  const dedupeKey = sha256([fanId, key, reasonCode, message, evidence, severity].join("|")).slice(0, 24);

  return {
    id: (body.id || "").toString().trim() || crypto.randomBytes(12).toString("hex"),
    type: "strike",
    ts,
    fanId,
    scope,
    scopeKey: key,
    artistId: artistId || null,
    roomId: roomId || null,
    reasonCode,
    message: message || null,
    evidence: evidence || null,
    severity,
    createdBy,
    dedupeKey,
    suspendUntil: addHours(ts, POLICY.autoSuspendHours)
  };
}

function normalizeUnbanBody(body) {
  return {
    ts: nowIso(),
    fanId: (body.fanId || "").toString().trim(),
    scope: normalizeScope(body.scope),
    artistId: (body.artistId || "").toString().trim() || null,
    roomId: (body.roomId || "").toString().trim() || null,
    createdBy: (body.createdBy || "admin").toString().trim(),
    note: (body.note || "").toString().trim() || null
  };
}

function validateStrike(evt) {
  if (!evt.fanId) return { ok: false, message: "Missing fanId." };
  if (!evt.scopeKey) return { ok: false, message: "Invalid scope." };
  if (!evt.reasonCode) return { ok: false, message: "Missing reasonCode." };
  return { ok: true };
}

async function recentDuplicateStrike(dedupeKey, fanId, key) {
  const nowMs = Date.now();
  const lines = await readJsonlLines(STRIKES_FILE, LIMITS.maxReadBytes);

  let scanned = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    scanned += 1;
    if (scanned > 6000) break;

    const evt = safeJson(lines[i]);
    if (!evt || evt.type !== "strike") continue;
    if ((evt.fanId || "").toString().trim() !== fanId) continue;
    if ((evt.scopeKey || "") !== key) continue;
    if ((evt.dedupeKey || "") !== dedupeKey) continue;

    const t = new Date(evt.ts).getTime();
    if (!Number.isFinite(t)) continue;
    return nowMs - t <= POLICY.dedupeWindowMs;
  }

  return false;
}

async function computeStatus({ fanId, scope, artistId, roomId }) {
  const key = scopeKey({ scope, artistId, roomId });
  const nowMs = Date.now();

  const strikeLines = await readJsonlLines(STRIKES_FILE, LIMITS.maxReadBytes);
  const banLines = await readJsonlLines(BANS_FILE, LIMITS.maxReadBytes);

  let scannedStrikes = 0;
  let scannedBans = 0;

  const strikes = [];
  let activeSuspensionUntil = null;

  for (let i = strikeLines.length - 1; i >= 0; i--) {
    scannedStrikes += 1;
    if (scannedStrikes > LIMITS.maxLineScan) break;

    const evt = safeJson(strikeLines[i]);
    if (!evt || evt.type !== "strike") continue;
    if ((evt.fanId || "").toString().trim() !== fanId) continue;
    if ((evt.scopeKey || "") !== key) continue;
    if (!withinLookback(evt.ts, POLICY.strikeWindowDays)) continue;

    strikes.push(evt);

    const untilMs = evt.suspendUntil ? parseUntil(evt.suspendUntil) : null;
    if (untilMs && untilMs > nowMs) {
      if (!activeSuspensionUntil || untilMs > parseUntil(activeSuspensionUntil)) {
        activeSuspensionUntil = evt.suspendUntil;
      }
    }
  }

  let activeBan = null;
  for (let i = banLines.length - 1; i >= 0; i--) {
    scannedBans += 1;
    if (scannedBans > LIMITS.maxLineScan) break;

    const evt = safeJson(banLines[i]);
    if (!evt || evt.type !== "ban") continue;
    if ((evt.fanId || "").toString().trim() !== fanId) continue;
    if ((evt.scopeKey || "") !== key) continue;

    if (isActiveBan(evt, nowMs)) {
      activeBan = evt;
      break;
    }
  }

  const isSuspended = !!activeSuspensionUntil && parseUntil(activeSuspensionUntil) > nowMs;
  const isBanned = !!activeBan;
  const allowed = !isSuspended && !isBanned;

  return {
    fanId,
    scope: normalizeScope(scope),
    scopeKey: key,
    artistId: (artistId || "").toString().trim() || null,
    roomId: (roomId || "").toString().trim() || null,
    allowed,
    strikes: {
      count: strikes.length,
      windowDays: POLICY.strikeWindowDays,
      banThreshold: POLICY.banOnStrikes,
      recent: strikes.slice(0, 25).map((s) => ({
        id: s.id,
        ts: s.ts,
        reasonCode: s.reasonCode,
        severity: s.severity,
        suspendUntil: s.suspendUntil || null,
        createdBy: s.createdBy || "system"
      }))
    },
    suspension: { active: isSuspended, until: activeSuspensionUntil || null },
    ban: {
      active: isBanned,
      until: activeBan ? activeBan.until : null,
      reason: activeBan ? activeBan.reasonCode || "threshold" : null,
      createdBy: activeBan ? activeBan.createdBy || "system" : null
    },
    updatedAt: nowIso(),
    debug: { scannedStrikesLines: scannedStrikes, scannedBansLines: scannedBans }
  };
}

// ----------------------------
// Routes
// ----------------------------
router.get("/health", async (req, res) => {
  await ensureDirs();

  let strikesStat = null;
  let bansStat = null;

  try { strikesStat = await fsp.stat(STRIKES_FILE); } catch { strikesStat = null; }
  try { bansStat = await fsp.stat(BANS_FILE); } catch { bansStat = null; }

  return res.json({
    success: true,
    service: "moderation",
    phase: "H5.1",
    storageDir: MOD_DIR,
    files: {
      strikes: { path: STRIKES_FILE, ok: !!strikesStat, size: strikesStat ? strikesStat.size : 0, mtimeMs: strikesStat ? strikesStat.mtimeMs : null },
      bans: { path: BANS_FILE, ok: !!bansStat, size: bansStat ? bansStat.size : 0, mtimeMs: bansStat ? bansStat.mtimeMs : null }
    },
    policy: POLICY,
    limits: LIMITS,
    ts: nowIso()
  });
});

router.get("/status/fan/:fanId", async (req, res) => {
  const fanId = (req.params.fanId || "").toString().trim();
  if (!fanId) return res.status(400).json({ success: false, error: "missing_fanId" });

  const scope = normalizeScope(req.query.scope);
  const artistId = (req.query.artistId || "").toString().trim();
  const roomId = (req.query.roomId || "").toString().trim();

  const status = await computeStatus({ fanId, scope, artistId, roomId });
  return res.json({ success: true, ...status });
});

router.post("/strike", async (req, res) => {
  const bytes = bodyBytes(req.body);
  if (bytes > LIMITS.maxBodyBytes) return res.status(413).json({ success: false, error: "payload_too_large" });

  const evt = normalizeStrikeBody(req.body || {});
  const v = validateStrike(evt);
  if (!v.ok) return res.status(400).json({ success: false, error: "validation_error", message: v.message });

  const dup = await recentDuplicateStrike(evt.dedupeKey, evt.fanId, evt.scopeKey);
  if (dup) {
    return res.json({
      success: true,
      deduped: true,
      message: "Duplicate strike ignored (dedupe window).",
      fanId: evt.fanId,
      scopeKey: evt.scopeKey,
      ts: evt.ts
    });
  }

  await appendJsonl(STRIKES_FILE, evt);

  const status = await computeStatus({
    fanId: evt.fanId,
    scope: evt.scope,
    artistId: evt.artistId || "",
    roomId: evt.roomId || ""
  });

  let banIssued = false;
  let banRecord = null;

  if (status.strikes.count >= POLICY.banOnStrikes) {
    banIssued = true;
    banRecord = {
      id: crypto.randomBytes(12).toString("hex"),
      type: "ban",
      ts: nowIso(),
      fanId: evt.fanId,
      scope: evt.scope,
      scopeKey: evt.scopeKey,
      artistId: evt.artistId || null,
      roomId: evt.roomId || null,
      reasonCode: "strike_threshold",
      strikeCount: status.strikes.count,
      until: addDays(nowIso(), POLICY.banDays),
      active: true,
      createdBy: evt.createdBy || "system",
      note: "Auto-ban: strike threshold reached"
    };
    await appendJsonl(BANS_FILE, banRecord);
  }

  return res.json({
    success: true,
    message: "Strike recorded.",
    deduped: false,
    strike: {
      id: evt.id,
      fanId: evt.fanId,
      scopeKey: evt.scopeKey,
      reasonCode: evt.reasonCode,
      severity: evt.severity,
      suspendUntil: evt.suspendUntil,
      ts: evt.ts
    },
    banIssued,
    ban: banRecord ? { id: banRecord.id, until: banRecord.until, scopeKey: banRecord.scopeKey, reasonCode: banRecord.reasonCode } : null
  });
});

router.post("/unban", async (req, res) => {
  const bytes = bodyBytes(req.body);
  if (bytes > LIMITS.maxBodyBytes) return res.status(413).json({ success: false, error: "payload_too_large" });

  const body = normalizeUnbanBody(req.body || {});
  if (!body.fanId) return res.status(400).json({ success: false, error: "missing_fanId" });

  const key = scopeKey({ scope: body.scope, artistId: body.artistId, roomId: body.roomId });

  const record = {
    id: crypto.randomBytes(12).toString("hex"),
    type: "ban",
    ts: nowIso(),
    fanId: body.fanId,
    scope: body.scope,
    scopeKey: key,
    artistId: body.artistId || null,
    roomId: body.roomId || null,
    reasonCode: "unban",
    until: nowIso(),
    active: false,
    createdBy: body.createdBy || "admin",
    note: body.note || null
  };

  await appendJsonl(BANS_FILE, record);

  return res.json({
    success: true,
    message: "Unban recorded.",
    fanId: body.fanId,
    scopeKey: key,
    ts: record.ts
  });
});

export default router;