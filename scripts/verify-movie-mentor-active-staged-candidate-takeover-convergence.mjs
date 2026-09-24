import assert from "node:assert/strict";
import fs from "node:fs";

console.log("5A.36 — active staged-candidate takeover convergence court");

const runtimeSource = fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js", import.meta.url), "utf8");

const convergeStart = runtimeSource.indexOf("async function convergeExistingTurn");
const convergeEnd = runtimeSource.indexOf("async function reconcileFailedExecution", convergeStart);
assert.ok(convergeStart >= 0 && convergeEnd > convergeStart, "runtime must expose existing-turn convergence");
const converge = runtimeSource.slice(convergeStart, convergeEnd);

assert.match(converge, /recoverStagedResultTurn/, "existing-turn convergence must own staged-result recovery");
assert.match(converge, /if \(s\(existing\.phase\) !== "active"\)/, "runtime must distinguish ACTIVE from terminal recovery");

const recoverStart = runtimeSource.indexOf("async function recoverStagedResultTurn");
const recoverEnd = runtimeSource.indexOf("async function convergeExistingTurn", recoverStart);
const recover = runtimeSource.slice(recoverStart, recoverEnd);
assert.match(recover, /\["closing", "closed", "finalized", "settled"\]/, "non-active staged candidate recovery must remain explicit");

const activeBranch = converge.slice(converge.indexOf("recoverStagedResultTurn"));
assert.match(
  activeBranch,
  /if \(s\(existing\.phase\) !== "active"\)[\s\S]*return null;/,
  "ACTIVE existing executions currently fall through to lease acquisition/orchestration",
);

assert.match(
  runtimeSource,
  /const candidate = await inferenceExecutionAuthority\.stageResultCandidate\(\{ execution, resultPayload: result \}\);/,
  "successful orchestration currently attempts a fresh candidate stage",
);

assert.match(
  runtimeSource,
  /async function acquireExistingExecution[\s\S]*acquireExecution/,
  "ACTIVE retry can reacquire the singleton execution after lease expiry",
);

assert.match(
  converge,
  /const staged = await inferenceExecutionAuthority\.readResultCandidate\(existing\.executionId\);[\s\S]*MOVIE_MENTOR_ACTIVE_RESULT_CANDIDATE_RECOVERY_REQUIRED/,
  "ACTIVE existing execution must detect a durable candidate before lease reacquisition/orchestration",
);
assert.match(
  converge,
  /Active execution already owns a durable result candidate and must resume candidate closure instead of orchestrating another result\./,
  "ACTIVE staged candidate must fail closed into explicit recovery rather than create a second result attempt",
);

console.log("✓ ACTIVE existing execution inspects durable candidate before reacquisition/orchestration");
console.log("✓ durable candidate blocks a second orchestration/result universe");
console.log("LAW: ACTIVE + DURABLE CANDIDATE IS RECOVERY STATE, NOT FRESH ORCHESTRATION AUTHORITY.");
