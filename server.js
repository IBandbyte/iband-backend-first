// server.js
// iBand Backend — Root Server (Captain’s Protocol)
// - Root-level file
// - Render-safe
// - Always JSON
// - Safe router loading (won't crash deploy if a module is missing)
//
// NOTE: This server uses dynamic imports guarded by fs.existsSync
// so deployments don't die if you temporarily rename/move a router file.

import fs from "fs";
import path from "path";
import express from "express";

const app = express();

const PORT = process.env.PORT || 10000;

// Basic middleware
app.use(express.json({ limit: "500kb" }));
app.use(express.urlencoded({ extended: true }));

// -------------------------
// Helpers
// -------------------------
function nowIso() {
  return new Date().toISOString();
}

function fileExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

async function safeMountRouter({ mountPath, fileName }) {
  try {
    const fullPath = path.join(process.cwd(), fileName);
    if (!fileExists(fullPath)) {
      return { ok: false, mounted: false, mountPath, fileName, reason: "MISSING_FILE" };
    }

    const mod = await import(`./${fileName}`);
    const router = mod?.default;
    if (!router) {
      return { ok: false, mounted: false, mountPath, fileName, reason: "NO_DEFAULT_EXPORT" };
    }

    app.use(mountPath, router);
    return { ok: true, mounted: true, mountPath, fileName };
  } catch (e) {
    return { ok: false, mounted: false, mountPath, fileName, reason: e?.message || "IMPORT_ERROR" };
  }
}

// -------------------------
// Root health
// -------------------------
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "iband-backend",
    timestamp: nowIso(),
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: nowIso(),
  });
});

// -------------------------
// Mount routers (safe)
// -------------------------
const mounts = [];

// IMPORTANT: keep the routing stable (API surface)
mounts.push(await safeMountRouter({ mountPath: "/api/artists", fileName: "artists.js" }));
mounts.push(await safeMountRouter({ mountPath: "/api/votes", fileName: "votes.js" }));
mounts.push(await safeMountRouter({ mountPath: "/api/ranking", fileName: "ranking.js" }));
mounts.push(await safeMountRouter({ mountPath: "/api/medals", fileName: "medals.js" }));
mounts.push(await safeMountRouter({ mountPath: "/api/flash-medals", fileName: "flashMedals.js" }));
mounts.push(await safeMountRouter({ mountPath: "/api/recs", fileName: "recs.js" }));
mounts.push(await safeMountRouter({ mountPath: "/api/achievements", fileName: "achievements.js" }));

// Phase H2: Purchases / Commerce
mounts.push(await safeMountRouter({ mountPath: "/api/purchases", fileName: "commerce.js" }));
// Alias (future): same router can be mounted twice safely
mounts.push(await safeMountRouter({ mountPath: "/api/commerce", fileName: "commerce.js" }));

// Expose what mounted (debug-friendly)
app.get("/api/_mounts", (_req, res) => {
  res.json({
    success: true,
    updatedAt: nowIso(),
    count: mounts.length,
    results: mounts,
  });
});

// 404 JSON
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found.",
    path: req.path,
    updatedAt: nowIso(),
  });
});

// Start
app.listen(PORT, () => {
  console.log(`iBand backend listening on port ${PORT}`);
  console.log("our service is live 🎉");
});