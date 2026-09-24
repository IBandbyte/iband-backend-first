import assert from "node:assert/strict";
import fs from "node:fs";

console.log("5A.40 — result-candidate ↔ abort/release serialization authority court");

const candidate = fs.readFileSync(new URL("../ai/MovieMentorResultCandidateMongoStore.js", import.meta.url), "utf8");
const settlement = fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js", import.meta.url), "utf8");

assert.match(candidate, /\$inc:\{resultCandidateBarrierRevision:1\}/,
  "candidate staging must mutate execution candidate barrier");

const release = settlement.slice(
  settlement.indexOf("async function releaseUnclaimedReservation"),
  settlement.indexOf("async function releaseUnboundReservation"),
);

assert.ok(
  release.includes("candidateBarrierRevision=Number.isSafeInteger(execution.resultCandidateBarrierRevision)?execution.resultCandidateBarrierRevision:0"),
  "release must snapshot the candidate barrier revision it proves",
);
assert.ok(
  release.includes("providerEffectRealityRevision:realityRevision,resultCandidateBarrierRevision:candidateBarrierRevision"),
  "predispatch-abandonment abort must CAS candidate barrier",
);
assert.ok(
  release.includes('"providerCalls.0":{$exists:false},resultCandidateBarrierRevision:candidateBarrierRevision'),
  "zero-claim abort must CAS candidate barrier",
);

console.log("LAW: RESULT-CANDIDATE STAGING AND ACTIVE→ABORTED RELEASE MUST SHARE ONE PHYSICAL SERIALIZATION BARRIER; RELEASE MAY NOT WIN WHILE CANDIDATE DURABILITY IS IN FLIGHT.");
