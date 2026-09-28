import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../ai/MovieMentorResultCandidateMongoStore.js", import.meta.url),
  "utf8",
);

console.log("Movie Mentor result-candidate stage DB-time authority court");

assert.match(
  source,
  /const\s+MONGO_SERVER_NOW\s*=\s*["'`]\\x24\\x24NOW["'`]/,
  "result-candidate staging must own an explicit Mongo server-time authority token",
);

assert.match(
  source,
  /\$expr\s*:\s*\{\s*\$gt\s*:\s*\[\s*["'`]\$leaseExpiresAt["'`]\s*,\s*MONGO_SERVER_NOW\s*\]\s*\}/,
  "result-candidate staging must prove execution lease liveness against Mongo server time in the same transactional execution barrier",
);

assert.doesNotMatch(
  source,
  /leaseExpiresAt\s*:\s*\{\s*\$gt\s*:\s*record\.stagedAt\s*\}/,
  "process-local stagedAt may record provenance but may not grant result-candidate lease authority",
);

console.log("GREEN: immutable result-candidate mint proves the exact execution lease is live by database time.");
console.log("LAW: PROCESS CLOCK MAY RECORD STAGING PROVENANCE; IT MAY NOT AUTHORIZE CREATOR-FACING RESULT TRUTH.");
