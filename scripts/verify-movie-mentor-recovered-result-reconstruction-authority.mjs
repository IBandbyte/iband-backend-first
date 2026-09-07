import assert from "node:assert/strict";
import { createFencedInferenceOrchestrationDeps } from "../ai/MovieMentorTurnRuntime.js";

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
    async reconstructRecoveredSemanticResult({ input, providerOperation, recoveredProviderResponse: response } = {}) {
      reconstructionCalls += 1;
      assert.equal(input?.message, "same creator turn");
      assert.deepEqual(providerOperation, {
        providerOperationId: "provider-call-semantic-one",
        executionId: execution.executionId,
        slotId: "semantic",
        task: "movie-mentor-semantic",
      });
      assert.equal(response?.id, "resp_same_operation");
      const candidate = JSON.parse(response.output_text);
      assert.equal(candidate.readyToAdvance, true);
      return Object.freeze({
        text: "",
        structured: { movieJourneyIntelligence: candidate },
        metadata: {
          provider: "openai",
          responseId: response.id,
          recoveredFromHistoricalProviderOperation: true,
          localAuthorityRevalidated: true,
        },
      });
    },
  },
});

const recovered = await fenced.interpretSemantics({ message: "same creator turn" });
assert.equal(recovered?.metadata?.recoveredFromHistoricalProviderOperation, true);
assert.equal(recovered?.metadata?.localAuthorityRevalidated, true);
assert.equal(liveProviderCalls, 0, "same admitted provider slot must never POST again");
assert.equal(beginDispatchCalls, 0, "recovery must not reopen UNKNOWN or dispatch admission");
assert.equal(assertDispatchCalls, 0, "recovery must not borrow creative dispatch authority");
assert.equal(recoveryCalls, 1, "same historical operation must be recovered exactly once");
assert.equal(reconstructionCalls, 1, "recovered bytes must pass the local reconstruction court exactly once");

let invalidRecoveryCalls = 0;
const invalidFenced = createFencedInferenceOrchestrationDeps({
  execution,
  inferenceExecutionAuthority: {
    ...authority,
    async recoverProviderOutcome(input) {
      invalidRecoveryCalls += 1;
      return authority.recoverProviderOutcome(input);
    },
  },
  deps: {
    async interpretSemantics() {
      throw new Error("invalid recovered bytes must not trigger a second POST");
    },
    async reconstructRecoveredSemanticResult() {
      const error = new Error("Recovered provider bytes failed the original local semantic contract.");
      error.code = "SEMANTIC_INTELLIGENCE_INVALID";
      throw error;
    },
  },
});

await assert.rejects(
  () => invalidFenced.interpretSemantics({ message: "same creator turn" }),
  (error) => error?.code === "SEMANTIC_INTELLIGENCE_INVALID",
  "provider recovery success must not manufacture local semantic result authority",
);
assert.equal(invalidRecoveryCalls, 1);

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
    async reconstructRecoveredSemanticResult() {
      throw new Error("wrong historical task must never reconstruct");
    },
  },
});

await assert.rejects(
  () => wrongBindingFenced.interpretSemantics({ message: "same creator turn" }),
  (error) => error?.code === "MOVIE_MENTOR_PROVIDER_RECOVERY_OPERATION_BINDING_INVALID",
  "a recovered result from a neighbouring task must never gain this slot's authority",
);
assert.equal(wrongBindingRecoveryCalls, 0);

console.log("Movie Mentor recovered-result reconstruction authority verifier passed.");
