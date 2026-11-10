import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const server = readFileSync(new URL("../server.js", import.meta.url), "utf8");
assert.match(server, /createMovieMentorCreatorStateRecoveryProductionComposition/, "RED: actual server must import the owner-proven read-only recovery composition");
assert.match(server, /readAuthoritativeTurnSource/, "RED: actual server must use canonical Mongo creator-state read");
assert.match(server, /\/api\/movie-mentor\/state\/recovery/, "RED: actual server must declare frontend-compatible recovery path");
assert.match(server, /\/api\/movie-mentor\/projects\/owned/, "RED: actual server must declare frontend-compatible owned-projects path");
console.log("GREEN: server registers frontend-compatible read-only recovery and owned-projects paths");
