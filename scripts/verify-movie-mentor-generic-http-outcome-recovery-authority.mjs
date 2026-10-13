import assert from "node:assert/strict";
import { createMovieMentorProviderOutcomeRecoveryAuthority } from "../ai/MovieMentorProviderOutcomeRecoveryAuthority.js";

const target = Object.freeze({
  provider: "generic-http",
  adapter: "generic-http",
  routeFingerprint: "c".repeat(64),
  recoveryMode: "none",
});
const binding = Object.freeze({
  providerCallId: "generic-call-1",
  executionId: "generic-execution-1",
  slotId: "semantic",
  task: "movie-mentor-semantic",
});
const operation = Object.freeze({ ...binding, providerTarget: target });
let effect = null;
let recoveryCalls = 0;
const authority = createMovieMentorProviderOutcomeRecoveryAuthority({
  readProviderOperation: async (id) => id === binding.providerCallId ? operation : null,
  readProviderEffectReality: async () => effect,
  resolveCurrentTarget: () => target,
  recoverProviderResponse: async () => {
    recoveryCalls += 1;
    throw new Error("generic-http must never use undeclared retrieval");
  },
});
function reality(state, evidence = []) {
  return { ...binding, state, evidence };
}
function noSecondEffect(result) {
  assert.equal(result.redispatchAuthorized, false);
  assert.equal(result.refundAuthorized, false);
  assert.equal(result.recoveryAuthorized, false);
  assert.equal(result.recovered, false);
  assert.equal(recoveryCalls, 0);
}
effect = reality("unknown");
const unknown = await authority.reconcile({ providerCallId: binding.providerCallId });
assert.equal(unknown.outcome, "STILL_UNKNOWN");
noSecondEffect(unknown);

effect = reality("confirmed", [{
  externalEffectId: "generic-response-1",
  provider: "generic-http",
  observedAt: "2033-01-01T00:00:00.000Z",
  source: "provider-response",
}]);
const confirmed = await authority.reconcile({ providerCallId: binding.providerCallId });
assert.equal(confirmed.outcome, "CONFIRMED_EFFECT");
assert.equal(confirmed.externalEffectId, "generic-response-1");
assert.equal(confirmed.reason, "provider-recovery-capability-not-declared");
noSecondEffect(confirmed);

effect = reality("conflict", [
  { externalEffectId: "generic-response-1", provider: "generic-http" },
  { externalEffectId: "generic-response-2", provider: "generic-http" },
]);
const conflicting = await authority.reconcile({ providerCallId: binding.providerCallId });
assert.equal(conflicting.outcome, "CONFLICTING_EFFECT");
assert.equal(conflicting.authorized, false);
noSecondEffect(conflicting);

console.log("GREEN: generic-http UNKNOWN, CONFIRMED and CONFLICTING effects never grant redispatch, automatic refund, or undeclared provider retrieval.");
