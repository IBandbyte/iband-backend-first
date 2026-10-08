import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bindCreatorDecisionCommitToTurn } from "../ai/MovieMentorCreatorStateConsumptionRuntime.js";

const runtime = readFileSync(new URL("../ai/MovieMentorTurnRuntime.js", import.meta.url), "utf8");
const consumption = readFileSync(new URL("../ai/MovieMentorCreatorStateConsumptionRuntime.js", import.meta.url), "utf8");
const orchestrator = readFileSync(new URL("../ai/MovieMentorTurnOrchestrator.js", import.meta.url), "utf8");
const lease = readFileSync(new URL("../ai/MovieMentorInferenceExecutionLeaseAuthority.js", import.meta.url), "utf8");

assert.match(runtime, /execution = await (?:openLiveExecution|acquireExistingExecution)/, "Live runtime must retain issued execution evidence");
assert.match(runtime, /createFencedInferenceOrchestrationDeps\(\{ execution, inferenceExecutionAuthority, deps \}\)/, "Provider orchestration must bind execution evidence");
assert.match(runtime, /commitCreatorDecision: deps\.commitCreatorDecision/, "Creator commit is still separately forwarded");
assert.match(orchestrator, /commitCreatorDecision\|\|commitCreatorDecision/, "Orchestrator must use its supplied commit dependency");
assert.match(lease, /const ownedExecutionEvidence = new WeakSet\(\)/, "Lease authority must retain private evidence identity");
assert.match(lease, /ownedExecutionEvidence\.has\(execution\)/, "Lease authority must check issued evidence identity");
assert.match(consumption, /baseCommit\(\{ \.\.\.args, creatorTurnId \}, commitDeps\)/, "Current turn binding forwards commit dependencies unchanged");

const calls = [];
const binder = bindCreatorDecisionCommitToTurn({ creatorTurnId: "turn-A" }, {
  commitCreatorDecision: async (args, deps) => { calls.push({ args, deps }); return { status: "observed" }; },
});
const substituted = Object.freeze({ authorized: true, executionId: "fake-execution", fencingToken: "fake-fence" });
await binder({ creatorTurnId: "turn-B", candidate: { decisionId: "decision-A" } }, { executionEvidence: substituted });
assert.equal(calls.length, 1);
assert.equal(calls[0].args.creatorTurnId, "turn-A", "Stable turn identity is correctly overridden");
assert.strictEqual(calls[0].deps.executionEvidence, substituted, "The existing binder does not authenticate arbitrary commit dependencies");

console.log(JSON.stringify({
  court: "creator-decision-evidence-handoff-baseline",
  classification: "audit-only gap characterization, NOT a security GREEN",
  liveExecutionEvidenceRetained: true,
  providerPathBindsEvidence: true,
  creatorCommitPathBindsEvidence: false,
  turnIdOverride: "enforced",
  commitDepsEvidenceAuthentication: "not enforced by current binder",
  warning: "This does not demonstrate a production caller can inject commitDeps; no such reachability is claimed."
}));
console.log("PASS: audit-only baseline accurately characterizes the missing creator-commit evidence handoff");
