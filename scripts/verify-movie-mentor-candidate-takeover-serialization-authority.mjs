import assert from "node:assert/strict";
import fs from "node:fs";
console.log("5A.39 — result-candidate ↔ lease-takeover serialization authority court");
const candidate=fs.readFileSync(new URL("../ai/MovieMentorResultCandidateMongoStore.js",import.meta.url),"utf8");
const execution=fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionMongoStore.js",import.meta.url),"utf8");
assert.match(candidate,/\$inc:\{resultCandidateBarrierRevision:1\}/,"candidate staging must mutate the execution candidate barrier");
const replace=execution.slice(execution.indexOf("async function replaceExecution"),execution.indexOf("async function claimProviderCall"));
assert.match(replace,/resultCandidateBarrierRevision:current\.resultCandidateBarrierRevision/,"lease renewal/takeover must CAS the same candidate barrier revision so it cannot cross an in-flight candidate transaction");
console.log("LAW: CANDIDATE STAGING AND ACTIVE LEASE REPLACEMENT/TAKEOVER MUST SHARE ONE PHYSICAL SERIALIZATION BARRIER.");
