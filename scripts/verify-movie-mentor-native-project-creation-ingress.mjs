import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

console.log("5A.25 — native project creation production ingress authority");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY = path.join(ROOT, "ai", "MovieMentorProjectOwnershipRegistry.js");
const SERVER = path.join(ROOT, "server.js");
const TURN = path.join(ROOT, "movieMentorTurn.js");

const registrySource = fs.readFileSync(REGISTRY, "utf8");
const serverSource = fs.readFileSync(SERVER, "utf8");
const turnSource = fs.readFileSync(TURN, "utf8");

assert.match(
  registrySource,
  /async function establishNativeOwnership\s*\(/,
  "project ownership registry must expose native ownership establishment authority"
);
assert.match(
  registrySource,
  /type\)\s*!==\s*["']native-project-creation["']/,
  "native ownership establishment must require server-trusted native-project-creation authority"
);
assert.match(
  registrySource,
  /MOVIE_MENTOR_PROJECT_OWNERSHIP_ESTABLISHMENT_CONFLICT/,
  "native ownership establishment must bind the exact principal and project"
);

const productionIngressOwnsNativeEstablishment =
  serverSource.includes("establishNativeOwnership") ||
  turnSource.includes("establishNativeOwnership") ||
  serverSource.includes("NativeProjectCreation") ||
  turnSource.includes("NativeProjectCreation");

assert.equal(
  productionIngressOwnsNativeEstablishment,
  true,
  "RED: native project ownership establishment exists only behind the registry; no production HTTP ingress owns first-party project creation."
);

assert.match(
  `${serverSource}\n${turnSource}`,
  /\/api\/movie-mentor[\s\S]{0,4000}(project|projects)[\s\S]{0,4000}(create|establish)/i,
  "RED: the authenticated creator gateway must expose a native project creation/establishment surface before state sync or turn can require durable ownership."
);

console.log("Movie Mentor native project creation ingress verification: PASS");
