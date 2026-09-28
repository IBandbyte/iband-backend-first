import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("../ai/MovieMentorLegacyMigrationChallengeStore.js",import.meta.url),"utf8");
console.log("Movie Mentor legacy migration challenge index provisioning authority court");
for(const declaration of [
 /schema\.index\(\{ challengeId: 1 \}, \{ unique: true \}\)/,
 /schema\.index\(\{ consumptionId: 1 \}, \{ unique: true, sparse: true \}\)/,
 /schema\.index\(\{ issuanceAdoptionId: 1 \}, \{ unique: true, sparse: true \}\)/
]) assert.match(source,declaration);
const readiness=source.slice(source.indexOf("async function physicalReadyBoundary"),source.indexOf("function normalize"));
assert.match(readiness,/createIndexes\(\)/,"legacy migration challenge readiness must explicitly provision its three authority-bearing unique indexes before trusting the physical catalogue");
assert.ok(readiness.indexOf("createIndexes()")>=0&&readiness.indexOf("collection.indexes()")>readiness.indexOf("createIndexes()"),"challenge index provisioning must precede physical catalogue observation");
assert.match(source,/async function persistMovieMentorLegacyMigrationChallenge[\s\S]*?await physicalReadyBoundary\(\)[\s\S]*?getModel\(\)\.create\(doc\)/);
console.log("PASS legacy migration challenge index provisioning authority.");
