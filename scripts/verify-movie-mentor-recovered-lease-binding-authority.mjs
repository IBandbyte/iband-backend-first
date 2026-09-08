import assert from "node:assert/strict";
import { recoverPreviouslyAdmittedProviderResult } from "../ai/MovieMentorRecoveredProviderResultAuthority.js";
import { digestMovieMentorProviderReconstructionInput } from "../ai/MovieMentorProviderOperationAuthority.js";

const execution = Object.freeze({
  authorized: true,
  executionAuthorized: true,
  executionId: "execution-lease-binding",
  ownerId: "worker-current",
  leaseGeneration: 7,
});
const historicalInput = Object.freeze({ message: "Preserve the exact historical turn." });
const historical = Object.freeze({
  providerCallId: "provider-call-lease-binding",
  executionId: execution.executionId,
  slotId: "semantic",
  task: "movie-mentor-semantic",
});
const decision = Object.freeze({
  dispatchAuthorized: false,
  reason: "provider-call-slot-already-admitted",
  existingProviderCallId: historical.providerCallId,
  existingProviderCall: historical,
});
const response = Object.freeze({ id: "resp-lease-binding", model: "gpt-test", output_text: "{}" });

let reconstructed = false;
await assert.rejects(
  () => recoverPreviouslyAdmittedProviderResult({
    decision,
    execution,
    slotId: historical.slotId,
    task: historical.task,
    input: historicalInput,
    recoverProviderOutcome: async ({ recoveryAuthority } = {}) => {
      assert.equal(recoveryAuthority, execution);
      return Object.freeze({
        outcome: "CONFIRMED_EFFECT",
        recovered: true,
        recoveryAuthorized: true,
        redispatchAuthorized: false,
        refundAuthorized: false,
        providerCallId: historical.providerCallId,
        executionId: historical.executionId,
        slotId: historical.slotId,
        task: historical.task,
        externalEffectId: response.id,
        recoveredProviderResponse: response,
        recoveryOwnerId: "worker-stale-neighbour",
        recoveryLeaseGeneration: 6,
      });
    },
    readProviderOperation: async () => Object.freeze({
      authorized: true,
      ...historical,
      providerTarget: Object.freeze({
        provider: "openai",
        adapter: "openai-responses",
        routeFingerprint: "a".repeat(64),
        recoveryMode: "known-response-id-retrieval",
      }),
      providerModel: "gpt-test",
      reconstructionInputDigest: digestMovieMentorProviderReconstructionInput(historicalInput),
      reconstructionInput: historicalInput,
    }),
    reconstructRecoveredResult: async () => {
      reconstructed = true;
      return Object.freeze({ success: true });
    },
  }),
  (error) => error?.code === "MOVIE_MENTOR_PROVIDER_RECOVERY_LEASE_BINDING_INVALID"
    && error?.expectedOwnerId === execution.ownerId
    && error?.actualOwnerId === "worker-stale-neighbour"
    && error?.expectedLeaseGeneration === execution.leaseGeneration
    && error?.actualLeaseGeneration === 6
    && error?.retryable === false,
  "recovered bytes must not enter local reconstruction under a stale or neighbouring recovery lease",
);
assert.equal(reconstructed, false, "stale recovery authority must be rejected before local reconstruction");

console.log("Movie Mentor recovered lease-binding authority verifier passed.");
