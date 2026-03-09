import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";

import { worldMapDiscovery } from "./world-map.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/*
Base storage directory
*/
const DATA_DIR = "/var/data/iband/db";

/*
Ensure directories exist
*/
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDir(DATA_DIR);

/*
Root endpoint
*/
app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "iband-backend",
    message: "iBand backend running",
    ts: new Date().toISOString()
  });
});

/*
Health check
*/
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "health",
    ts: new Date().toISOString()
  });
});

/*
--------------------------------------------------
DISCOVERY ENGINE ROUTES
--------------------------------------------------
*/

/*
World Music Map
*/
app.get("/api/discovery/world-map", worldMapDiscovery);

/*
--------------------------------------------------
SERVER START
--------------------------------------------------
*/

app.listen(PORT, () => {
  console.log(`iBand backend running on port ${PORT}`);
});