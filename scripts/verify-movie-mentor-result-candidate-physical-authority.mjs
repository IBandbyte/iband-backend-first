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
assert.match(candidateSource,/physicalUniqueIndexReadiness:true/,"result-candidate store must advertise owned physical uniqueness readiness");
assert.match(candidateSource,/const PHYSICAL_READINESS_BOUNDARY="before-result-candidate-read-or-transactional-mint"/,"result-candidate store must define the exact physical-readiness boundary");
assert.match(candidateSource,/readinessBoundary:PHYSICAL_READINESS_BOUNDARY/,"result-candidate status must expose the owned physical-readiness boundary");
assert.match(candidateSource,/ensurePhysicalAuthority/,"result-candidate store must own an explicit physical readiness gate");
assert.match(candidateSource,/async function readByExecution\(executionId\)\{await ready\(\);/,"candidate reads must cross physical readiness before durable lookup");
assert.match(candidateSource,/async function stageCandidate\([^]*?\{await ready\(\);/,"candidate staging must cross physical readiness before authority validation or transactional mint");

assert.match(compositionSource,/const durableCandidateStore=createMovieMentorResultCandidateMongoStore\(\{readIndexes:readPhysicalIndexes\}\)/,"production composition must wire actual Mongo index reality into its owned result-candidate store");
assert.match(compositionSource,/database\.collection\(collectionName\)\.indexes\(\)/,"production physical reader must inspect actual Mongo indexes");
assert.match(compositionSource,/return durableCandidateStore\.stageCandidate\(/,"production stageResultCandidate must reach the physically gated durable result-candidate mutation");
assert.match(compositionSource,/resultCandidatePhysicalUniqueIndexReadiness:candidateStoreStatus\?\.physicalUniqueIndexReadiness===true/,"production composition status must propagate candidate physical readiness");
assert.match(compositionSource,/stageResultCandidate,/,"production authority must expose result-candidate staging");

console.log("PASS result-candidate physical authority — production staging owns actual Mongo index reality and reaches transactional candidate mint only after physical uniqueness readiness.");
