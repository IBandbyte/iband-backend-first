import assert from "node:assert/strict";
import { createFencedInferenceOrchestrationDeps } from "../ai/MovieMentorTurnRuntime.js";
import { reconstructRecoveredMovieMentorSemanticResult } from "../ai/MovieMentorRecoveredSemanticResult.js";

const execution = Object.freeze({
  authorized: true,
  executionAuthorized: true,
  executionId: "execution-recovery-two",
  ownerId: "worker-generation-two",
  leaseGeneration: 2,
  leaseReference: "lease-generation-two",
  fencingToken: "fence-generation-two",
});

let liveProviderCalls = 0;
let recoveryCalls = 0;
let reconstructionCalls = 0;
let beginDispatchCalls = 0;
let assertDispatchCalls = 0;

const recoveredProviderResponse = Object.freeze({
  id: "resp_same_operation",
  model: "gpt-test",
  output_text: JSON.stringify({
    understoodContext: [],
    provisionalContext: [],
    unresolvedContext: [],
    clarificationNeeded: [],
    readyToAdvance: true,
    recommendedStageId: null,
    recommendedTaskId: null,
    nextAction: null,
    resumeNote: null,
  }),
});

const authority = {
  async claimProviderCall({ slotId, task } = {}) {
    assert.equal(slotId, "semantic");
    assert.equal(task, "movie-mentor-semantic");
    return Object.freeze({
      authorized: false,
      dispatchAuthorized: false,
      reason: "provider-call-slot-already-admitted",
      existingProviderCallId: "provider-call-semantic-one",
      existingProviderCall: Object.freeze({
        providerCallId: "provider-call-semantic-one",
        executionId: execution.executionId,
        slotId: "semantic",
        task: "movie-mentor-semantic",
      }),
    });
  },
  async beginProviderDispatch() {
    beginDispatchCalls += 1;
    throw new Error("duplicate provider dispatch must never begin");
  },
  async assertProviderDispatch() {
    assertDispatchCalls += 1;
    throw new Error("duplicate provider dispatch must never be asserted");
  },
  async contributeProviderEffectEvidence() {},
  async recoverProviderOutcome({ providerCallId, recoveryAuthority } = {}) {
    recoveryCalls += 1;
    assert.equal(providerCallId, "provider-call-semantic-one");
    assert.equal(recoveryAuthority, execution);
    return Object.freeze({
      outcome: "CONFIRMED_EFFECT",
      recovered: true,
      recoveryAuthorized: true,
      redispatchAuthorized: false,
      refundAuthorized: false,
      providerCallId,
      executionId: execution.executionId,
      slotId: "semantic",
      task: "movie-mentor-semantic",
      externalEffectId: recoveredProviderResponse.id,
      recoveredProviderResponse,
      recoveryOwnerId: execution.ownerId,
      recoveryLeaseGeneration: execution.leaseGeneration,
    });
  },
};

const fenced = createFencedInferenceOrchestrationDeps({
  execution,
  inferenceExecutionAuthority: authority,
  deps: {
    async interpretSemantics() {
      liveProviderCalls += 1;
      throw new Error("a recovered historical slot must not create a second provider POST");
    },
    async reconstructRecoveredSemanticResult(input) {
      reconstructionCalls += 1;
      return reconstructRecoveredMovieMentorSemanticResult(input);
    },
  },
});

const recovered = await fenced.interpretSemantics({ message: "same creator turn" });
assert.equal(recovered?.metadata?.recoveredFromHistoricalProviderOperation, true);
assert.equal(recovered?.metadata?.localAuthorityRevalidated, true);
assert.equal(recovered?.metadata?.responseId, "resp_same_operation");
assert.equal(recovered?.structured?.movieJourneyIntelligence?.readyToAdvance, true);
assert.equal(liveProviderCalls, 0, "same admitted provider slot must never POST again");
assert.equal(beginDispatchCalls, 0, "recovery must not reopen UNKNOWN or dispatch admission");
assert.equal(assertDispatchCalls, 0, "recovery must not borrow creative dispatch authority");
assert.equal(recoveryCalls, 1, "same historical operation must be recovered exactly once");
assert.equal(reconstructionCalls, 1, "recovered bytes must pass the real semantic reconstruction court exactly once");

let invalidRecoveryCalls = 0;
const malformedProviderResponse = Object.freeze({
  id: "resp_invalid_semantic",
  model: "gpt-test",
  output_text: JSON.stringify({
    understoodContext: [{ key: "truth", value: "invented", evidence: null, confidenceSource: "creator-confirmed" }],
    provisionalContext: [],
    unresolvedContext: [],
    clarificationNeeded: [{ key: "x", expression: null, question: null, reason: null, material: true }],
    readyToAdvance: true,
    recommendedStageId: null,
    recommendedTaskId: null,
    nextAction: null,
    resumeNote: null,
  }),
});
const invalidFenced = createFencedInferenceOrchestrationDeps({
  execution,
  inferenceExecutionAuthority: {
    ...authority,
    async recoverProviderOutcome({ providerCallId, recoveryAuthority } = {}) {
      invalidRecoveryCalls += 1;
      assert.equal(recoveryAuthority, execution);
      return Object.freeze({
        outcome: "CONFIRMED_EFFECT",
        recovered: true,
        recoveryAuthorized: true,
        redispatchAuthorized: false,
        refundAuthorized: false,
        providerCallId,
        executionId: execution.executionId,
        slotId: "semantic",
        task: "movie-mentor-semantic",
        externalEffectId: malformedProviderResponse.id,
        recoveredProviderResponse: malformedProviderResponse,
        recoveryOwnerId: execution.ownerId,
        recoveryLeaseGeneration: execution.leaseGeneration,
      });
    },
  },
  deps: {
    async interpretSemantics() {
      throw new Error("invalid recovered bytes must not trigger a second POST");
    },
    reconstructRecoveredSemanticResult: reconstructRecoveredMovieMentorSemanticResult,
  },
});

await assert.rejects(
  () => invalidFenced.interpretSemantics({ message: "same creator turn" }),
  (error) => error?.code === "SEMANTIC_INTELLIGENCE_INVALID",
  "provider recovery success must not manufacture local semantic result authority",
);
assert.equal(invalidRecoveryCalls, 1);

let unknownRecoveryCalls = 0;
let unknownReconstructionCalls = 0;
const unknownFenced = createFencedInferenceOrchestrationDeps({
  execution,
  inferenceExecutionAuthority: {
    ...authority,
    async recoverProviderOutcome({ providerCallId } = {}) {
      unknownRecoveryCalls += 1;
      return Object.freeze({
        outcome: "STILL_UNKNOWN",
        recovered: false,
        recoveryAuthorized: false,
        redispatchAuthorized: false,
        refundAuthorized: false,
        providerCallId,
        executionId: execution.executionId,
        slotId: "semantic",
        task: "movie-mentor-semantic",
      });
    },
  },
  deps: {
    async interpretSemantics() {
      throw new Error("UNKNOWN historical work must never become a second POST");
    },
    async reconstructRecoveredSemanticResult() {
      unknownReconstructionCalls += 1;
      throw new Error("UNKNOWN has no recovered bytes to reconstruct");
    },
  },
});
await assert.rejects(
  () => unknownFenced.interpretSemantics({ message: "same creator turn" }),
  (error) => error?.code === "MOVIE_MENTOR_PROVIDER_RECOVERY_STILL_UNKNOWN",
  "true UNKNOWN must remain fail-closed without reconstruction or redispatch",
);
assert.equal(unknownRecoveryCalls, 1);
assert.equal(unknownReconstructionCalls, 0);

let wrongBindingRecoveryCalls = 0;
const wrongBindingFenced = createFencedInferenceOrchestrationDeps({
  execution,
  inferenceExecutionAuthority: {
    ...authority,
    async claimProviderCall() {
      return Object.freeze({
        authorized: false,
        dispatchAuthorized: false,
        reason: "provider-call-slot-already-admitted",
        existingProviderCallId: "provider-call-synthesis-one",
        existingProviderCall: Object.freeze({
          providerCallId: "provider-call-synthesis-one",
          executionId: execution.executionId,
          slotId: "synthesis",
          task: "movie-mentor-synthesis",
        }),
      });
    },
    async recoverProviderOutcome() {
      wrongBindingRecoveryCalls += 1;
      throw new Error("wrong task binding must be rejected before provider recovery");
    },
  },
  deps: {
    async interpretSemantics() {
      throw new Error("wrong historical task must never POST");
    },
    reconstructRecoveredSemanticResult: reconstructRecoveredMovieMentorSemanticResult,
  },
});

await assert.rejects(
  () => wrongBindingFenced.interpretSemantics({ message: "same creator turn" }),
  (error) => error?.code === "MOVIE_MENTOR_PROVIDER_RECOVERY_OPERATION_BINDING_INVALID",
  "a recovered result from a neighbouring task must never gain this slot's authority",
);
assert.equal(wrongBindingRecoveryCalls, 0);

console.log("Movie Mentor recovered-result reconstruction authority verifier passed.");
