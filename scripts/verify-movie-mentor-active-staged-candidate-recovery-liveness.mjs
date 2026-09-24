import assert from "node:assert/strict";
import fs from "node:fs";

console.log("5A.37 — active staged-candidate recovery liveness court");

const runtime = fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js", import.meta.url), "utf8");
const closure = fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionClosureAuthority.js", import.meta.url), "utf8");

assert.match(runtime,/MOVIE_MENTOR_ACTIVE_RESULT_CANDIDATE_RECOVERY_REQUIRED/,"#335 must preserve fail-closed active candidate detection");
assert.match(closure,/async function recoverExpiredIntoClosing/,"closure authority has a durable expired-ACTIVE recovery primitive");
assert.match(closure,/return freeze\(\{beginClosing,recoverExpiredIntoClosing,reconcile,assertCurrentClosure/,"closure authority exposes expired-ACTIVE recovery");

assert.doesNotMatch(
  runtime,
  /recoverExpiredIntoClosing/,
  "runtime currently has no path that invokes the existing expired-ACTIVE closure recovery primitive"
);

assert.fail(
  "ACTIVE execution with a durable candidate is now fail-closed by #335, but runtime never invokes recoverExpiredIntoClosing; after the lease expires the preserved candidate can remain permanently ACTIVE instead of advancing into CLOSING/closure."
);
