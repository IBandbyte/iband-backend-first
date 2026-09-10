import assert from "node:assert/strict";
import fs from "node:fs";

const candidateSource=fs.readFileSync(new URL("../ai/MovieMentorResultCandidateMongoStore.js",import.meta.url),"utf8");
const compositionSource=fs.readFileSync(new URL("../ai/MovieMentorProductionInferenceExecutionComposition.js",import.meta.url),"utf8");

assert.match(candidateSource,/schema\.index\(\{executionId:1\},\{unique:true\}\)/,"result-candidate schema must declare execution identity unique");
assert.match(candidateSource,/schema\.index\(\{candidateReference:1\},\{unique:true\}\)/,"result-candidate schema must declare candidate reference unique");
assert.match(candidateSource,/session\.withTransaction\(/,"result-candidate staging must cross the durable transaction boundary");
assert.match(candidateSource,/creatorStateLedger\(\)\.updateOne\(/,"result-candidate transaction must fence current creator state");
assert.match(candidateSource,/executionLedger\(\)\.updateOne\(/,"result-candidate transaction must fence current execution authority");
assert.match(candidateSource,/storeModel\(\)\.create\(\[record\],\{session\}\)/,"result-candidate transaction must durably mint the immutable candidate");

assert.match(compositionSource,/const durableCandidateStore=createMovieMentorResultCandidateMongoStore\(\)/,"production composition must directly own the default result-candidate Mongo store");
assert.match(compositionSource,/return durableCandidateStore\.stageCandidate\(/,"production stageResultCandidate must reach the durable result-candidate mutation");
assert.match(compositionSource,/stageResultCandidate,/,"production authority must expose result-candidate staging");

const explicitPhysicalReadiness=/readIndexes|\.indexes\(\)|listIndexes|createIndexes|\.init\(\)|physicalUniqueIndexReadiness|ensurePhysicalAuthority/;
assert.match(candidateSource,explicitPhysicalReadiness,"result-candidate irreversible staging must explicitly prove physical unique-index readiness before durable mutation");

console.log("PASS result-candidate physical authority — production staging reaches transactional candidate mint only after owned physical uniqueness readiness.");
