import assert from "node:assert/strict";
import fs from "node:fs";

console.log("5A.38 — result-candidate ↔ closure serialization authority court");

const candidate = fs.readFileSync(new URL("../ai/MovieMentorResultCandidateMongoStore.js", import.meta.url), "utf8");
const execution = fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionMongoStore.js", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js", import.meta.url), "utf8");

assert.match(candidate,/executionLedger\(\)\.updateOne/);
assert.match(candidate,/\$inc:\{resultCandidateBarrierRevision:1\}/);
assert.match(candidate,/phase:"active"/);
assert.match(execution,/async function beginClosing/);
assert.match(execution,/async function recoverExpiredIntoClosing/);
assert.match(runtime,/stageResultCandidate/);
assert.match(runtime,/beginExecutionClosing/);

const closureSection = execution.slice(execution.indexOf("async function beginClosing"), execution.indexOf("async function completeClosing"));
assert.match(closureSection,/beginClosing[\s\S]*resultCandidateBarrierRevision:current\.resultCandidateBarrierRevision/,"live ACTIVE→CLOSING must bind the candidate barrier revision");
assert.match(closureSection,/recoverExpiredIntoClosing[\s\S]*resultCandidateBarrierRevision:current\.resultCandidateBarrierRevision/,"expired ACTIVE→CLOSING recovery must bind the candidate barrier revision");
assert.match(execution,/resultCandidateBarrierRevision:\{type:Number,min:0,default:0\}/,"execution schema must durably own the candidate barrier revision");

console.log("LAW: RESULT-CANDIDATE STAGING AND ACTIVE→CLOSING MUST SHARE ONE PHYSICAL SERIALIZATION BARRIER; CLOSING MAY NOT WIN WHILE A VALID CANDIDATE TRANSACTION IS STILL IN FLIGHT.");
