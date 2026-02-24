/**
 * server.js (root) — ESM
 * iBand Backend — Canonical bootstrap (Captain’s Protocol)
 *
 * Goals:
 * - Always boot, even if a module is missing (safe dynamic imports)
 * - Mount all routers consistently
 * - Render-safe JSON APIs only
 */

import express from "express";
import cors from "cors";

const app = express();

// -------------------- Core middleware --------------------
app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// -------------------- Helpers --------------------
function nowIso() {
  return new Date().toISOString();
}

async function safeImportRouter(relPath) {
  try {
    const mod = await import(relPath);
    const router = mod?.default;
    if (typeof router !== "function") {
      return { ok: false, error: "no_default_export_router", path: relPath };
    }
    return { ok: true, router, path: relPath };
  } catch (e) {
    return { ok: false, error: e?.message || "import_failed", path: relPath };
  }
}

function mountIfOk(basePath, imp, registry) {
  if (imp.ok) {
    app.use(basePath, imp.router);
    registry.mounted.push({ basePath, file: imp.path });
  } else {
    registry.missing.push({ basePath, file: imp.path, error: imp.error });
  }
}

// -------------------- Status endpoints --------------------
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "iband-backend",
    timestamp: nowIso(),
  });
});

app.get("/status", (_req, res) => {
  const uptime = process.uptime();
  res.json({
    status: "ok",
    uptime,
    timestamp: nowIso(),
  });
});

// -------------------- Router mounting --------------------
const registry = { mounted: [], missing: [] };

// Import/mount in a stable order
const routersToMount = [
  { base: "/api/artists", file: "./artists.js" },
  { base: "/api/events", file: "./events.js" },
  { base: "/api/votes", file: "./votes.js" },
  { base: "/api/ranking", file: "./ranking.js" },
  { base: "/api/recs", file: "./recs.js" },
  { base: "/api/medals", file: "./medals.js" },
  { base: "/api/flash-medals", file: "./flashMedals.js" },
  { base: "/api/live-feed", file: "./liveFeed.js" },
  { base: "/api/achievements", file: "./achievements.js" }, // ✅ Phase G2
];

// Load sequentially to keep logs readable on Render
for (const r of routersToMount) {
  // eslint-disable-next-line no-await-in-loop
  const imp = await safeImportRouter(r.file);
  mountIfOk(r.base, imp, registry);
}

// Router registry endpoint (debug)
app.get("/api/_registry", (_req, res) => {
  res.json({
    success: true,
    updatedAt: nowIso(),
    mounted: registry.mounted,
    missing: registry.missing,
  });
});

// 404 JSON
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found.",
    path: req.originalUrl,
    updatedAt: nowIso(),
  });
});

// -------------------- Listen --------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  // Render logs
  console.log(`iBand backend listening on port ${PORT}`);
});