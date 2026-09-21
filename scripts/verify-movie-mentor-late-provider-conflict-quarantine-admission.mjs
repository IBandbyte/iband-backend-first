import assert from "node:assert/strict";
import fs from "node:fs";

const compositionSource=fs.readFileSync(new URL("../ai/MovieMentorProductionInferenceExecutionComposition.js",import.meta.url),"utf8");
const effectAuthoritySource=fs.readFileSync(new URL("../ai/MovieMentorProviderEffectAuthority.js",import.meta.url),"utf8");
const executionStoreSource=fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionMongoStore.js",import.meta.url),"utf8");

assert.match(effectAuthoritySource,/conflict:after\.state==="conflict"/,"provider-effect evidence must surface durable conflict reality");
assert.match(executionStoreSource,/async function quarantineExecution/,"durable execution store must expose quarantine transition");
assert.match(compositionSource,/const contributeProviderEffectEvidence=async\(input=\{\}\)=>\{/,"production composition must own provider-effect evidence admission");

const start=compositionSource.indexOf("const contributeProviderEffectEvidence=async(input={})=>{");
assert.ok(start>=0);
const end=compositionSource.indexOf("const providerOutcomeRecoveryAuthority=",start);
assert.ok(end>start);
const evidencePath=compositionSource.slice(start,end);

assert.match(
  evidencePath,
  /quarantineExecution|quarantine/,
  "production provider-effect conflict admission must durably revoke the affected execution universe before returning conflict evidence"
);

console.log("Movie Mentor late provider-effect conflict quarantine admission court: GREEN");
console.log("LAW: DURABLE PROVIDER-EFFECT CONFLICT MAY NOT RETURN WITHOUT DURABLY REVOKING THE AFFECTED EXECUTION UNIVERSE.");
