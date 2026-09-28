import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor provider reconstruction-input first-bind DB-time authority court");

const path = new URL("../ai/MovieMentorProviderOperationMongoStore.js", import.meta.url);
const source = fs.readFileSync(path, "utf8");

const start = source.indexOf("async function bindReconstructionInput");
assert.notEqual(start, -1, "bindReconstructionInput production path must exist");
const end = source.indexOf("\n  return Object.freeze", start);
const block = source.slice(start, end === -1 ? source.length : end);

assert.match(
  block,
  /\$expr\s*:\s*\{\s*\$gt\s*:\s*\[\s*["']\$leaseExpiresAt["']\s*,\s*MONGO_SERVER_NOW\s*\]\s*\}/,
  "first reconstruction-input bind must prove execution lease liveness against Mongo server time in the same serialization touch",
);
assert.doesNotMatch(
  block,
  /leaseExpiresAt\s*:\s*\{\s*\$gt\s*:\s*timestamp\s*\}/,
  "process-supplied reconstruction boundAt must not own execution lease liveness",
);

console.log("GREEN: first reconstruction-input bind proves live execution authority against Mongo server time.");
console.log("LAW: IMMUTABLE RECONSTRUCTION INPUT MAY FIRST-BIND ONLY WHILE THE EXACT ADMITTING EXECUTION LEASE IS LIVE BY DATABASE TIME.");
