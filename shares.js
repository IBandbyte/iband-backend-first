import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const router = express.Router();

const SERVICE = "shares";
const PHASE = "H4";
const VERSION = 2;

const DATA_DIR = "/var/data/iband/db";
const SHARES_DIR = path.join(DATA_DIR, "shares/events");
const SHARES_FILE = path.join(SHARES_DIR, "shares.jsonl");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeEvent(event) {
  ensureDir(SHARES_DIR);
  fs.appendFileSync(SHARES_FILE, JSON.stringify(event) + "\n");
}

/*
Health check
*/
router.get("/health", (req, res) => {

  res.json({
    success: true,
    service: SERVICE,
    phase: PHASE,
    storageDir: SHARES_DIR,
    eventsFile: {
      path: SHARES_FILE,
      ok: fs.existsSync(SHARES_FILE),
      size: fs.existsSync(SHARES_FILE) ? fs.statSync(SHARES_FILE).size : 0
    },
    ts: new Date().toISOString()
  });

});

/*
Record share event
*/
router.post("/", (req, res) => {

  try {

    const { artistId, fanId, platform } = req.body;

    if (!artistId) {
      return res.status(400).json({
        success: false,
        error: "artistId_required"
      });
    }

    const event = {
      id: crypto.randomBytes(12).toString("hex"),
      type: "share",
      artistId,
      fanId: fanId || null,
      platform: platform || "iband",
      ts: new Date().toISOString()
    };

    writeEvent(event);

    res.json({
      success: true,
      message: "Share recorded",
      event
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      error: "share_record_failed",
      message: err.message
    });

  }

});

export default router;