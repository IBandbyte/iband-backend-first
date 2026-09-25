import assert from "node:assert/strict";
import fs from "node:fs";

console.log("5A.42 — Creator Compensation current provider-reality authority court");

const settlement = fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js", import.meta.url), "utf8");
const effects = fs.readFileSync(new URL("../ai/MovieMentorProviderEffectMongoStore.js", import.meta.url), "utf8");

const start = settlement.indexOf("async function compensateSupersededCreatorState");
const end = settlement.indexOf("return Object.freeze({settleCanonicalResult", start);
assert.ok(start >= 0 && end > start, "Creator Compensation writer must be present");
const compensation = settlement.slice(start, end);

assert.match(
  effects,
  /executionLedger\(\)\.updateOne\(\{executionId:current\.executionId\},\{\$inc:\{providerEffectRealityRevision:1\}\}/,
  "late provider evidence must advance execution reality revision",
);
assert.ok(
  compensation.includes("realityRevision=Number.isSafeInteger(execution.providerEffectRealityRevision)?execution.providerEffectRealityRevision:0"),
  "Creator Compensation must snapshot current provider reality",
);
assert.ok(
  compensation.includes("candidateBarrierRevision=Number.isSafeInteger(execution.resultCandidateBarrierRevision)?execution.resultCandidateBarrierRevision:0"),
  "Creator Compensation must snapshot current candidate barrier",
);
assert.ok(
  compensation.includes("providerEffectRealityRevision:realityRevision,resultCandidateBarrierRevision:candidateBarrierRevision"),
  "terminal compensation CAS must bind both proved revisions",
);

console.log("LAW: CREATOR COMPENSATION MAY RESTORE ENTITLEMENT ONLY FROM THE SAME PROVIDER-REALITY/CANDIDATE UNIVERSE IT PROVED.");
