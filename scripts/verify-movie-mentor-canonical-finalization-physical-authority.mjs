import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Canonical finalization physical authority court");

const storeSource=fs.readFileSync(new URL("../ai/MovieMentorCanonicalResultMongoStore.js",import.meta.url),"utf8");
const compositionSource=fs.readFileSync(new URL("../ai/MovieMentorProductionInferenceExecutionComposition.js",import.meta.url),"utf8");

// Production reachability: the production execution composition creates the real
// canonical Mongo store and hands it to the canonical result authority.
assert.match(compositionSource,/createMovieMentorCanonicalResultMongoStore\(\)/,
  "production composition must create the canonical Mongo store");
assert.match(compositionSource,/createMovieMentorCanonicalResultAuthority\(\{store:durableResultStore/,
  "production canonical authority must consume the durable canonical store");
assert.match(storeSource,/async function commit\(/,
  "canonical store must expose the irreversible commit boundary");
assert.match(storeSource,/session\.withTransaction\(/,
  "canonical finalization must cross a Mongo transaction boundary");

// The five canonical identities are schema-declared unique. Schema declaration is
// not physical database reality and therefore cannot itself authorize finalization.
for(const identity of [
  /schema\.index\(\{resultReference:1\},\{unique:true\}\)/,
  /schema\.index\(\{candidateReference:1\},\{unique:true\}\)/,
  /schema\.index\(\{executionId:1\},\{unique:true\}\)/,
  /schema\.index\(\{principalId:1,projectId:1,creatorTurnId:1\},\{unique:true\}\)/,
  /schema\.index\(\{reservationId:1\},\{unique:true\}\)/
]) assert.match(storeSource,identity,"canonical identity must remain schema-declared unique");

const readyMatch=storeSource.match(/async function readyForCommit\(\)\{([\s\S]*?)\}async function readByExecution/);
assert.ok(readyMatch,"canonical commit readiness boundary must be discoverable");
const readiness=readyMatch[1];

const physicalSignals=[
  /\.indexes\s*\(/,
  /\.listIndexes\s*\(/,
  /createIndexes\s*\(/,
  /\.init\s*\(/,
  /physicalUniqueIndexReadiness/,
  /CanonicalResultPhysicalAuthority/
];
assert.ok(physicalSignals.some(pattern=>pattern.test(readiness)),
  "canonical finalization must explicitly initialize or verify physical unique indexes before transaction authority");

const transactionAt=storeSource.indexOf("session.withTransaction");
const physicalAt=Math.max(
  storeSource.indexOf(".indexes("),
  storeSource.indexOf(".listIndexes("),
  storeSource.indexOf("createIndexes("),
  storeSource.indexOf(".init("),
  storeSource.indexOf("physicalUniqueIndexReadiness"),
  storeSource.indexOf("CanonicalResultPhysicalAuthority")
);
assert.ok(physicalAt>=0&&physicalAt<transactionAt,
  "physical unique-index proof must occur before canonical finalization enters its irreversible transaction");

console.log("PASS canonical finalization owns physical uniqueness proof before irreversible Mongo authority");
