import assert from "node:assert/strict";
import { createMovieMentorProviderOutcomeRecoveryAuthority } from "../ai/MovieMentorProviderOutcomeRecoveryAuthority.js";

const operation = Object.freeze({
  authorized: true,
  providerCallId: "provider-call-post-io-fence",
  providerOperationId: "provider-call-post-io-fence",
  executionId: "execution-post-io-fence",
  slotId: "semantic",
  task: "movie-mentor-semantic",
  providerTarget: Object.freeze({
    provider: "openai",
    adapter: "openai-responses",
    routeFingerprint: "a".repeat(64),
    recoveryMode: "known-response-id-retrieval",
  }),
});
const effect = Object.freeze({
  providerCallId: operation.providerCallId,
  executionId: operation.executionId,
  slotId: operation.slotId,
  task: operation.task,
  state: "confirmed",
  evidence: Object.freeze([
    Object.freeze({ externalEffectId: "resp-post-io-fence", provider: "openai", source: "provider-response" }),
  ]),
});
const recoveryAuthority = Object.freeze({
  authorized: true,
  executionAuthorized: true,
  executionId: operation.executionId,
  ownerId: "worker-generation-seven",
  leaseGeneration: 7,
  leaseReference: "lease-generation-seven",
  fencingToken: "fence-generation-seven",
});

let fenceChecks = 0;
let networkReads = 0;
let leaseLostDuringNetwork = false;

const authority = createMovieMentorProviderOutcomeRecoveryAuthority({
  readProviderOperation: async () => operation,
  readProviderEffectReality: async () => effect,
  resolveCurrentTarget: () => operation.providerTarget,
  requireRecoveryAuthority: true,
  assertCurrentRecoveryAuthority: async ({ recoveryAuthority: supplied } = {}) => {
    fenceChecks += 1;
    assert.equal(supplied, recoveryAuthority);
    if (leaseLostDuringNetwork) {
      return Object.freeze({
        authorized: false,
        currentRecoveryAuthorityVerified: false,
        reason: "execution-recovery-fenced-after-provider-io",
      });
    }
    return Object.freeze({
      authorized: true,
      currentRecoveryAuthorityVerified: true,
      transition: "provider-outcome-recovery",
      executionId: operation.executionId,
      providerCallId: operation.providerCallId,
      ownerId: recoveryAuthority.ownerId,
      leaseGeneration: recoveryAuthority.leaseGeneration,
      leaseReference: recoveryAuthority.leaseReference,
      fencingToken: recoveryAuthority.fencingToken,
    });
  },
  recoverProviderResponse: async (request) => {
    networkReads += 1;
    assert.equal(request.providerCallId, operation.providerCallId);
    // The irreversible provider recovery I/O completes, but this worker loses
    // its execution lease before the recovered bytes are returned to callers.
    leaseLostDuringNetwork = true;
    return Object.freeze({
      provider: "openai",
      externalEffectId: "resp-post-io-fence",
      providerOperationId: operation.providerCallId,
      response: Object.freeze({ id: "resp-post-io-fence", model: "gpt-test", output_text: "{}" }),
    });
  },
});

await assert.rejects(
  () => authority.reconcile({ providerCallId: operation.providerCallId, recoveryAuthority }),
  (error) => error?.code === "MOVIE_MENTOR_PROVIDER_RECOVERY_POST_IO_AUTHORITY_REVOKED"
    && error?.retryable === true,
  "provider recovery must re-prove the exact current recovery lease after network I/O before recovered bytes gain authority",
);
assert.equal(networkReads, 1, "the court must cross the provider recovery I/O boundary exactly once");
assert.equal(fenceChecks, 2, "recovery authority must be checked both before and after provider recovery I/O");

console.log("Movie Mentor provider recovery post-I/O lease authority verifier passed.");
