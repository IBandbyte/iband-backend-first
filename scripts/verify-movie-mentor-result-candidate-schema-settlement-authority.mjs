import assert from "node:assert/strict";
import fs from "node:fs";
import { getMovieMentorResultCandidateMongoStoreStatus } from "../ai/MovieMentorResultCandidateMongoStore.js";

console.log("5A.27 — result-candidate schema settlement authority");

const candidateStatus = getMovieMentorResultCandidateMongoStoreStatus();
const settlementSource = fs.readFileSync(
  new URL("../ai/MovieMentorInferenceSettlementMongoStore.js", import.meta.url),
  "utf8",
);

assert.equal(
  candidateStatus.schema,
  2,
  "the current durable result-candidate store must advertise schema 2",
);

assert.match(
  settlementSource,
  /candidate\?\.schema!==2/,
  "settlement must accept the current durable result-candidate schema rather than rejecting every schema-2 candidate as legacy/invalid",
);

assert.doesNotMatch(
  settlementSource,
  /candidate\?\.schema!==1/,
  "settlement must not hard-code the superseded schema-1 result-candidate contract",
);

console.log("✓ settlement accepts the exact current durable result-candidate schema");
console.log("LAW: CURRENT DURABLE SCHEMA MUST CROSS EVERY IRREVERSIBLE BOUNDARY OR THE GATE FAILS CLOSED.");
console.log("5A.27 result-candidate schema settlement authority: GREEN");
