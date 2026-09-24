import assert from "node:assert/strict";
import fs from "node:fs";

console.log("5A.37 — active staged-candidate recovery liveness court");

const runtime = fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js", import.meta.url), "utf8");
const closure = fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionClosureAuthority.js", import.meta.url), "utf8");

assert.match(runtime,/MOVIE_MENTOR_ACTIVE_RESULT_CANDIDATE_RECOVERY_REQUIRED/,"#335 must preserve fail-closed active candidate detection");
assert.match(closure,/async function recoverExpiredIntoClosing/,"closure authority has a durable expired-ACTIVE recovery primitive");
assert.match(closure,/return freeze\(\{beginClosing,recoverExpiredIntoClosing,reconcile,assertCurrentClosure/,"closure authority exposes expired-ACTIVE recovery");

assert.match(
  runtime,
  /recoverExpiredExecutionIntoClosing\(\{ executionId: existing\.executionId \}\)/,
  "runtime must invoke production-composed expired-ACTIVE closure recovery for a durable candidate"
);
assert.match(
  runtime,
  /recoveredClosing\?\.authorized !== true \|\| s\(recoveredClosing\.phase\) !== "closing"/,
  "runtime must fail closed unless expired-ACTIVE recovery actually owns CLOSING"
);
assert.match(
  runtime,
  /return recoverStagedResultTurn\(\{[\s\S]*phase: "closing"/,
  "successful ACTIVE candidate recovery must continue through the existing staged-result closure/canonical/settlement path"
);

console.log("✓ ACTIVE durable candidate invokes expired-execution closure recovery");
console.log("✓ recovery must prove authoritative CLOSING before candidate continuation");
console.log("✓ preserved candidate resumes existing closure/canonical/settlement convergence");
console.log("LAW: ACTIVE + DURABLE CANDIDATE + EXPIRED LEASE → RECOVER SAME EXECUTION INTO CLOSING → SAME CANDIDATE UNIVERSE CONTINUES.");
