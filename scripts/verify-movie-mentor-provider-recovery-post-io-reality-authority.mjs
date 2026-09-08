import assert from "node:assert/strict";
import { createMovieMentorProviderOutcomeRecoveryAuthority } from "../ai/MovieMentorProviderOutcomeRecoveryAuthority.js";

const operation = Object.freeze({
  authorized: true,
  providerCallId: "provider-call-post-io-reality",
  providerOperationId: "provider-call-post-io-reality",
  executionId: "execution-post-io-reality",
  slotId: "semantic",
  task: "movie-mentor-semantic",
  providerTarget: Object.freeze({
    provider: "openai",
    adapter: "openai-responses",
    routeFingerprint: "b".repeat(64),
    recoveryMode: "known-response-id-retrieval",
  }),
});

let realityReads = 0;
let conflictArrivedDuringNetwork = false;
let networkReads = 0;

function reality() {
  const evidence = conflictArrivedDuringNetwork
    ? [
        Object.freeze({ externalEffectId: "resp-reality-a", provider: "openai", source: "provider-response" }),
        Object.freeze({ externalEffectId: "resp-reality-b", provider: "openai", source: "provider-response" }),
      ]
    : [Object.freeze({ externalEffectId: "resp-reality-a", provider: "openai", source: "provider-response" })];
  return Object.freeze({
    providerCallId: operation.providerCallId,
    executionId: operation.executionId,
    slotId: operation.slotId,
    task: operation.task,
    state: conflictArrivedDuringNetwork ? "conflict" : "confirmed",
    revision: conflictArrivedDuringNetwork ? 2 : 1,
    evidence: Object.freeze(evidence),
  });
}

const authority = createMovieMentorProviderOutcomeRecoveryAuthority({
  readProviderOperation: async () => operation,
  readProviderEffectReality: async () => {
    realityReads += 1;
    return reality();
  },
  resolveCurrentTarget: () => operation.providerTarget,
  recoverProviderResponse: async () => {
    networkReads += 1;
    conflictArrivedDuringNetwork = true;
    return Object.freeze({
      provider: "openai",
      externalEffectId: "resp-reality-a",
      providerOperationId: operation.providerCallId,
      response: Object.freeze({ id: "resp-reality-a", model: "gpt-test", output_text: "{}" }),
    });
  },
});

const result = await authority.reconcile({ providerCallId: operation.providerCallId });
assert.equal(networkReads, 1, "the court must cross provider recovery I/O exactly once");
assert.equal(realityReads, 2, "provider-effect reality must be re-read after recovery I/O before bytes gain authority");
assert.equal(result.outcome, "CONFLICTING_EFFECT", "a conflict that arrives during provider recovery I/O must revoke recovered-byte authority");
assert.equal(result.recovered, false);
assert.equal(result.recoveryAuthorized, false);
assert.equal(result.redispatchAuthorized, false);
assert.equal(result.refundAuthorized, false);
assert.equal(result.reason, "provider-effect-reality-changed-during-recovery");

console.log("Movie Mentor provider recovery post-I/O reality authority verifier passed.");
