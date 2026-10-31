import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// VERIFIER FIRST: a clean browser cannot rely on its predecessor's localStorage.
// This contract deliberately fails until an authenticated, owner-bound creator-state
// retrieval route exists. It does not connect to or write any database.
const route = readFileSync(new URL("../movieMentorTurn.js", import.meta.url), "utf8");
const projects = readFileSync(new URL("../movieMentorProjects.js", import.meta.url), "utf8");
const routes = route + "\n" + projects;
assert.match(routes, /router\.get\(\s*["']\/state\/recovery\/:projectId["']/, "Missing authenticated creator-facing authoritative state recovery GET route");
assert.match(routes, /requestAuthority\.authorize/, "Recovery route must invoke authenticated project ownership authority");
assert.match(routes, /readAuthoritativeTurnSource/, "Recovery route must read server-authoritative persisted creator state");
console.log("Creator-state fresh-browser recovery route contract passed.");
