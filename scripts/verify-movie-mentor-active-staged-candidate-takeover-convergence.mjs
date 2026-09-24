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

assert.fail(
  "ACTIVE execution with an already durable immutable result candidate has no explicit convergence path before reacquisition/orchestration; after takeover a newly reconstructed result can collide with the historical candidate instead of deterministically resuming candidate -> closure."
);
