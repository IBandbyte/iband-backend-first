import assert from "node:assert/strict";
import { createFencedInferenceOrchestrationDeps } from "../ai/MovieMentorTurnRuntime.js";
import { reconstructRecoveredMovieMentorSemanticResult } from "../ai/MovieMentorRecoveredSemanticResult.js";
import { DERIVED_CONTINUITY_AUTHORITY } from "../ai/MovieMentorContinuityConsequenceAuthority.js";
import { digestMovieMentorProviderReconstructionInput } from "../ai/MovieMentorProviderOperationAuthority.js";

const execution = Object.freeze({
  authorized: true,
  executionAuthorized: true,
  executionId: "execution-recovery-two",
  ownerId: "worker-generation-two",
  leaseGeneration: 2,
  leaseReference: "lease-generation-two",
  fencingToken: "fence-generation-two",
});

const historicalProviderModel = "gpt-test";
const historicalProviderTarget = Object.freeze({
  provider: "openai",
  adapter: "openai-responses",
  routeFingerprint: "a".repeat(64),
  recoveryMode: "known-response-id-retrieval",
});

let liveProviderCalls = 0;
let recoveryCalls = 0;
let reconstructionCalls = 0;
let beginDispatchCalls = 0;
let assertDispatchCalls = 0;

const semanticHistoricalInput = Object.freeze({ message: "same creator turn" });
const recoveredProviderResponse = Object.freeze({
  id: "resp_same_operation",
  model: historicalProviderModel,
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
  async readProviderOperation(providerCallId) {
    assert.equal(providerCallId, "provider-call-semantic-one");
    return Object.freeze({
      authorized: true,
      providerCallId,
      providerOperationId: providerCallId,
      executionId: execution.executionId,
      slotId: "semantic",
      task: "movie-mentor-semantic",
      providerTarget: historicalProviderTarget,
      providerModel: historicalProviderModel,
      reconstructionInputDigest: digestMovieMentorProviderReconstructionInput(semanticHistoricalInput),
      reconstructionInput: semanticHistoricalInput,
    });
  },
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
      assert.deepEqual(input.input, semanticHistoricalInput, "semantic reconstruction must receive the frozen historical input, not today's caller input");
      return reconstructRecoveredMovieMentorSemanticResult(input);
    },
  },
});

const recovered = await fenced.interpretSemantics({ message: "different current creator turn" });
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
  model: historicalProviderModel,
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
  () => invalidFenced.interpretSemantics({ message: "current universe must not matter" }),
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

function historicalAuthority({ slotId, task, providerCallId, response, historicalInput = null }) {
  let recoveries = 0;
  const value = {
    async claimProviderCall({ slotId: requestedSlot, task: requestedTask } = {}) {
      assert.equal(requestedSlot, slotId);
      assert.equal(requestedTask, task);
      return Object.freeze({
        authorized: false,
        dispatchAuthorized: false,
        reason: "provider-call-slot-already-admitted",
        existingProviderCallId: providerCallId,
        existingProviderCall: Object.freeze({
          providerCallId,
          executionId: execution.executionId,
          slotId,
          task,
        }),
      });
    },
    async beginProviderDispatch() { throw new Error("historical slot must not reopen dispatch"); },
    async assertProviderDispatch() { throw new Error("historical slot must not regain POST authority"); },
    async contributeProviderEffectEvidence() {},
    async readProviderOperation(requestedId) {
      assert.equal(requestedId, providerCallId);
      return Object.freeze({
        authorized: true,
        providerCallId,
        providerOperationId: providerCallId,
        executionId: execution.executionId,
        slotId,
        task,
        providerTarget: historicalProviderTarget,
        providerModel: historicalProviderModel,
        reconstructionInputDigest: historicalInput ? digestMovieMentorProviderReconstructionInput(historicalInput) : null,
        reconstructionInput: historicalInput,
      });
    },
    async recoverProviderOutcome({ providerCallId: requestedId, recoveryAuthority } = {}) {
      recoveries += 1;
      assert.equal(requestedId, providerCallId);
      assert.equal(recoveryAuthority, execution);
      return Object.freeze({
        outcome: "CONFIRMED_EFFECT",
        recovered: true,
        recoveryAuthorized: true,
        redispatchAuthorized: false,
        refundAuthorized: false,
        providerCallId,
        executionId: execution.executionId,
        slotId,
        task,
        externalEffectId: response.id,
        recoveredProviderResponse: response,
        recoveryOwnerId: execution.ownerId,
        recoveryLeaseGeneration: execution.leaseGeneration,
      });
    },
    get recoveries() { return recoveries; },
  };
  return value;
}

const storyWorkOrder = Object.freeze({
  agentId: "story",
  purpose: "Protect the premise.",
  authority: "mentor-provisional",
  creatorFacing: false,
  mayAdvanceJourney: false,
  mayOverwriteCreatorTruth: false,
  input: Object.freeze({
    creatorMessage: "same creator turn",
    semanticIntelligence: {},
    creatorConfirmedContext: [],
    continuationObedienceEnvelope: { references: [], requiredReferenceIds: [] },
  }),
});
const storyResponse = Object.freeze({
  id: "resp_story_same_operation",
  model: historicalProviderModel,
  output_text: JSON.stringify({
    agentId: "story",
    observations: [],
    provisionalSuggestions: [],
    risksAndConflicts: [],
    creatorConfirmedDependencies: [],
    continuationObedienceClaims: [],
    confidence: 0.8,
    provenance: { source: "provider", model: null, contractVersion: "provider" },
  }),
});
const storyAuthority = historicalAuthority({
  slotId: "story",
  task: "movie-mentor-specialist:story",
  providerCallId: "provider-call-story-one",
  response: storyResponse,
  historicalInput: storyWorkOrder,
});
let storyPosts = 0;
const storyFenced = createFencedInferenceOrchestrationDeps({
  execution,
  inferenceExecutionAuthority: storyAuthority,
  deps: {
    async executeSpecialistWorkOrder() {
      storyPosts += 1;
      throw new Error("story historical slot must not POST again");
    },
  },
});
const storyPlan = await storyFenced.executeSpecialistPlan({ workOrders: [{ ...storyWorkOrder, purpose: "CURRENT-B MUST NOT WIN" }] });
assert.equal(storyPlan.status, "completed");
assert.equal(storyPlan.contributions.length, 1);
assert.equal(storyPlan.contributions[0].agentId, "story");
assert.equal(storyPlan.metadata[0].metadata.localAuthorityRevalidated, true);
assert.equal(storyPosts, 0);
assert.equal(storyAuthority.recoveries, 1);

const synthesisInput = Object.freeze({
  creatorMessage: "same creator turn",
  creatorConfirmedContext: [],
  semanticIntelligence: { clarificationNeeded: [] },
  semanticMentorDraft: null,
  contributions: [],
  continuityConsequenceEnvelope: {
    status: "consistent",
    requiresClarification: false,
    authority: DERIVED_CONTINUITY_AUTHORITY,
    constraints: [],
  },
  continuationObedienceEnvelope: { references: [], requiredReferenceIds: [] },
});
const synthesisResponse = Object.freeze({
  id: "resp_synthesis_same_operation",
  model: historicalProviderModel,
  output_text: JSON.stringify({
    text: "Recovered same synthesis.",
    usedContributionAgentIds: [],
    deferredContributionAgentIds: [],
    continuationObedienceClaims: [],
    conflictsHandled: [],
    confidence: 1,
    provenance: { source: "provider", model: null, contractVersion: "provider" },
  }),
});
const synthesisAuthority = historicalAuthority({
  slotId: "synthesis",
  task: "movie-mentor-synthesis",
  providerCallId: "provider-call-synthesis-one",
  response: synthesisResponse,
  historicalInput: synthesisInput,
});
let synthesisPosts = 0;
const synthesisFenced = createFencedInferenceOrchestrationDeps({
  execution,
  inferenceExecutionAuthority: synthesisAuthority,
  deps: {
    async synthesizeResponse() {
      synthesisPosts += 1;
      throw new Error("synthesis historical slot must not POST again");
    },
  },
});
const synthesis = await synthesisFenced.synthesizeResponse({ ...synthesisInput, creatorMessage: "CURRENT-B MUST NOT WIN" });
assert.equal(synthesis.success, true);
assert.equal(synthesis.text, "Recovered same synthesis.");
assert.equal(synthesis.metadata.localAuthorityRevalidated, true);
assert.equal(synthesisPosts, 0);
assert.equal(synthesisAuthority.recoveries, 1);

const continuityResponse = Object.freeze({
  id: "resp_continuity_historical",
  model: historicalProviderModel,
  output_text: "{}",
});
const continuityAuthority = historicalAuthority({
  slotId: "continuity",
  task: "movie-mentor-specialist:continuity",
  providerCallId: "provider-call-continuity-one",
  response: continuityResponse,
  historicalInput: null,
});
let continuityPosts = 0;
const continuityFenced = createFencedInferenceOrchestrationDeps({
  execution,
  inferenceExecutionAuthority: continuityAuthority,
  deps: {
    async executeSpecialistWorkOrder() {
      continuityPosts += 1;
      throw new Error("continuity historical slot must not POST again");
    },
  },
});
const continuityPlan = await continuityFenced.executeSpecialistPlan({
  workOrders: [{
    agentId: "continuity",
    authority: "mentor-provisional",
    creatorFacing: false,
    mayAdvanceJourney: false,
    mayOverwriteCreatorTruth: false,
    mayCreateCanon: false,
    input: { currentCreatorTruth: [] },
  }],
});
assert.equal(continuityPlan.status, "partial");
assert.equal(continuityPlan.contributions.length, 0);
assert.equal(continuityPlan.failures[0]?.code, "MOVIE_MENTOR_PROVIDER_RECOVERY_INPUT_AUTHORITY_REQUIRED");
assert.equal(continuityPosts, 0, "continuity must never POST a duplicate operation");
assert.equal(continuityAuthority.recoveries, 1, "continuity may retrieve same historical response but missing historical input still yields zero result authority");

console.log("Movie Mentor recovered-result reconstruction authority verifier passed.");