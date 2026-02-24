/**
 * server.js (root) — iBand Backend Gateway (ESM)
 *
 * Captain’s Protocol:
 * - Full canonical file
 * - Mount all routers explicitly
 * - Never crash deploy if one optional router is missing
 */

import express from "express";
import cors from "cors";

const app = express();

// -------------------- Core Middleware --------------------
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// -------------------- Base Health --------------------
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// -------------------- Router loader (optional-safe) --------------------
async function mountRouter({ name, mountPath, modulePath }) {
  try {
    const mod = await import(modulePath);
    const router = mod?.default;
    if (!router) throw new Error(`No default export in ${modulePath}`);
    app.use(mountPath, router);
    // eslint-disable-next-line no-console
    console.log(`Mounted ${name} at ${mountPath} from ${modulePath}`);
    return { ok: true };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(`Skipped ${name} (${mountPath}) — ${e?.message || String(e)}`);
    return { ok: false, error: e?.message || String(e) };
  }
}

// -------------------- Mount all known APIs --------------------
await mountRouter({ name: "artists", mountPath: "/api/artists", modulePath: "./artists.js" });
await mountRouter({ name: "votes", mountPath: "/api/votes", modulePath: "./votes.js" });
await mountRouter({ name: "ranking", mountPath: "/api/ranking", modulePath: "./ranking.js" });
await mountRouter({ name: "recs", mountPath: "/api/recs", modulePath: "./recs.js" });
await mountRouter({ name: "medals", mountPath: "/api/medals", modulePath: "./medals.js" });
await mountRouter({ name: "flash-medals", mountPath: "/api/flash-medals", modulePath: "./flashMedals.js" });
await mountRouter({ name: "achievements", mountPath: "/api/achievements", modulePath: "./achievements.js" });

// -------------------- 404 Handler --------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found.",
    path: req.path,
    updatedAt: new Date().toISOString(),
  });
});

// -------------------- Start --------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`iBand backend listening on port ${PORT}`);
  // eslint-disable-next-line no-console
  console.log("our service is live 🎉");
});