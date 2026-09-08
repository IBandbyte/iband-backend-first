import assert from "node:assert/strict";
import { createFencedInferenceOrchestrationDeps } from "../ai/MovieMentorTurnRuntime.js";
import { createDerivedContinuityConstraint } from "../ai/MovieMentorContinuityConsequenceAuthority.js";
import { digestMovieMentorProviderReconstructionInput } from "../ai/MovieMentorProviderOperationAuthority.js";

const generationOne = Object.freeze({
  authorized: true,
  executionAuthorized: true,
  executionId: "execution-continuity-input",
  ownerId: "worker-generation-one",
  leaseGeneration: 1,
  leaseReference: "lease-generation-one",
  fencingToken: "fence-generation-one",
});
const generationTwo = Object.freeze({
  authorized: true,
  executionAuthorized: true,
  executionId: generationOne.executionId,
  ownerId: "worker-generation-two",
  leaseGeneration: 2,
  leaseReference: "lease-generation-two",
  fencingToken: "fence-generation-two",
});

const call = Object.freeze({
  authorized: true,
  dispatchAuthorized: true,
  providerCallId: "provider-call-continuity-input-one",
  executionId: generationOne.executionId,
  slotId: "continuity",
  task: "movie-mentor-specialist:continuity",
  ownerId: generationOne.ownerId,
  leaseGeneration: generationOne.leaseGeneration,
  leaseReference: generationOne.leaseReference,
  fencingToken: generationOne.fencingToken,
});

const currentCreatorTruth = Object.freeze([
  Object.freeze({ key: "story.setting", value: "coastal-town", current: true, authority: "creator", confidenceSource: "creator-confirmed" }),
]);
const cacheA = Object.freeze([
  Object.freeze(createDerivedContinuityConstraint({
    category: "location",
    key: "hero.location",
    value: "harbour",
    reason: "Established from the creator-confirmed coastal setting.",
    confidence: 1,
    dependencies: [{ key: "story.setting", value: "coastal-town" }],
  }, currentCreatorTruth)),
]);
const cacheB = Object.freeze([
  Object.freeze(createDerivedContinuityConstraint({
    category: "location",
    key: "hero.location",
    value: "tower",
    reason: "A later derived-cache interpretation of the same creator-confirmed setting.",
    confidence: 1,
    dependencies: [{ key: "story.setting", value: "coastal-town" }],
  }, currentCreatorTruth)),
]);

let durableHistoricalInput = null;
let bindInputCalls = 0;
let beginUnknownCalls = 0;
let liveContinuityCalls = 0;
let recoveryCalls = 0;
let cacheReadCalls = 0;
let activeCache = cacheA;
let takeover = false;

const historicalProviderModel = "test-model";
const historicalProviderTarget = Object.freeze({
  provider: "openai",
  adapter: "openai-responses",
  routeFingerprint: "a".repeat(64),
  recoveryMode: "known-response-id-retrieval",
});
const recoveredProviderResponse = Object.freeze({
  id: "resp-continuity-input-one",
  model: historicalProviderModel,
  output_text: JSON.stringify({
    agentId: "continuity",
    derivedConstraints: [],
    continuityConflicts: [],
    unresolvedContinuityQuestions: [],
    provisionalSuggestions: [],
    confidence: 1,
    provenance: { source: "provider", model: historicalProviderModel, contractVersion: "2.1.1" },
  }),
});

const authority = {
  async claimProviderCall({ execution, slotId, task } = {}) {
    assert.equal(slotId, "continuity");
    assert.equal(task, "movie-mentor-specialist:continuity");
    if (takeover) {
      assert.equal(execution?.ownerId, generationTwo.ownerId);
      return Object.freeze({
        authorized: false,
        dispatchAuthorized: false,
        reason: "provider-call-slot-already-admitted",
        existingProviderCallId: call.providerCallId,
        existingProviderCall: Object.freeze({
          providerCallId: call.providerCallId,
          executionId: call.executionId,
          slotId: call.slotId,
          task: call.task,
        }),
      });
    }
    assert.equal(execution?.ownerId, generationOne.ownerId);
    return call;
  },
  async bindProviderReconstructionInput({ providerCall, reconstructionInput } = {}) {
    bindInputCalls += 1;
    assert.equal(providerCall?.providerCallId, call.providerCallId);
    assert.ok(reconstructionInput, "exact continuity reconstruction input must exist before UNKNOWN");
    durableHistoricalInput = structuredClone(reconstructionInput);
    return Object.freeze({
      authorized: true,
      inputBound: true,
      providerCallId: call.providerCallId,
      executionId: call.executionId,
      slotId: call.slotId,
      task: call.task,
      reconstructionInput: structuredClone(durableHistoricalInput),
    });
  },
  async beginProviderDispatch({ providerCall } = {}) {
    beginUnknownCalls += 1;
    assert.equal(providerCall?.providerCallId, call.providerCallId);
    assert.equal(bindInputCalls, 1, "historical Continuity input must be durable before UNKNOWN begins");
    assert.deepEqual(
      durableHistoricalInput?.input?.reusableDerivedContinuity,
      cacheA,
      "the exact cache-derived provider input must be frozen before UNKNOWN",
    );
    return Object.freeze({ ...call, providerEffectState: "unknown" });
  },
  async assertProviderDispatch() {
    return call;
  },
  async contributeProviderEffectEvidence() {},
  async readProviderOperation(providerCallId) {
    assert.equal(providerCallId, call.providerCallId);
    assert.ok(durableHistoricalInput, "historical reconstruction input must survive process takeover");
    return Object.freeze({
      authorized: true,
      providerCallId: call.providerCallId,
      providerOperationId: call.providerCallId,
      executionId: call.executionId,
      slotId: call.slotId,
      task: call.task,
      providerTarget: historicalProviderTarget,
      providerModel: historicalProviderModel,
      reconstructionInputDigest: digestMovieMentorProviderReconstructionInput(durableHistoricalInput),
      reconstructionInput: structuredClone(durableHistoricalInput),
    });
  },
  async recoverProviderOutcome({ providerCallId, recoveryAuthority } = {}) {
    recoveryCalls += 1;
    assert.equal(providerCallId, call.providerCallId);
    assert.equal(recoveryAuthority?.ownerId, generationTwo.ownerId);
    return Object.freeze({
      outcome: "CONFIRMED_EFFECT",
      recovered: true,
      recoveryAuthorized: true,
      redispatchAuthorized: false,
      refundAuthorized: false,
      providerCallId: call.providerCallId,
      executionId: call.executionId,
      slotId: call.slotId,
      task: call.task,
      externalEffectId: recoveredProviderResponse.id,
      recoveredProviderResponse,
      recoveryOwnerId: generationTwo.ownerId,
      recoveryLeaseGeneration: generationTwo.leaseGeneration,
    });
  },
};

const workOrder = Object.freeze({
  agentId: "continuity",
  authority: "mentor-provisional",
  creatorFacing: false,
  mayAdvanceJourney: false,
  mayOverwriteCreatorTruth: false,
  mayCreateCanon: false,
  input: Object.freeze({
    creatorMessage: "Keep her at the harbour.",
    semanticIntelligence: {},
    currentCreatorTruth,
    projectJourney: null,
    memoryContext: null,
    currentScene: null,
    previousScenes: [],
    stageId: "stage-one",
    taskId: "task-one",
    turnContextAuthority: Object.freeze({
      revision: 4,
      snapshotReference: "snapshot-four",
      creatorState: Object.freeze({ generation: 7, fingerprint: "fingerprint-seven" }),
    }),
    projectId: "project-one",
  }),
});

const specialistDeps = {
  async readReusableContinuityDerivedCache() {
    cacheReadCalls += 1;
    if (takeover) {
      assert.fail("historical Continuity recovery must never consult the mutable current derived cache");
    }
    return Object.freeze({ hit: true, stale: false, constraints: structuredClone(activeCache), record: null, reasons: [] });
  },
  async executeContinuityAgent(preparedWorkOrder) {
    liveContinuityCalls += 1;
    assert.deepEqual(preparedWorkOrder?.input?.reusableDerivedContinuity, cacheA);
    return Object.freeze({
      success: true,
      contribution: Object.freeze({
        agentId: "continuity",
        derivedConstraints: structuredClone(cacheA),
        newlyDerivedConstraints: [],
        continuityConflicts: [],
        unresolvedContinuityQuestions: [],
        provisionalSuggestions: [],
        continuityConsequenceEnvelope: Object.freeze({ status: "consistent", requiresClarification: false, constraints: structuredClone(cacheA) }),
        reusableDerivedContinuityConsumed: structuredClone(cacheA),
        confidence: 1,
        provenance: Object.freeze({ source: "movie-mentor-continuity-agent", model: "test", contractVersion: "2.1.1" }),
        authority: "mentor-provisional",
        creatorFacing: false,
        mayAdvanceJourney: false,
        mayOverwriteCreatorTruth: false,
        mayCreateCanon: false,
        mayPromoteInferenceToCanon: false,
        requiresMentorSynthesis: true,
      }),
      metadata: {},
    });
  },
  async readAuthoritativeTurnSource() {
    return Object.freeze({
      projectId: "project-one",
      revision: 4,
      creatorStateGeneration: 7,
      creatorStateFingerprint: "fingerprint-seven",
      snapshotReference: "snapshot-four",
      creatorConfirmedContext: structuredClone(currentCreatorTruth),
    });
  },
};

const firstFenced = createFencedInferenceOrchestrationDeps({
  execution: generationOne,
  inferenceExecutionAuthority: authority,
  deps: { specialistDeps },
});
const first = await firstFenced.executeSpecialistPlan({ workOrders: [workOrder] });
assert.equal(first.status, "completed", JSON.stringify(first.failures));
assert.equal(cacheReadCalls, 1, "fresh Continuity may read current cache exactly once to build its historical input");
assert.equal(bindInputCalls, 1);
assert.equal(beginUnknownCalls, 1);
assert.equal(liveContinuityCalls, 1);
assert.deepEqual(durableHistoricalInput?.input?.reusableDerivedContinuity, cacheA);

activeCache = cacheB;
takeover = true;
assert.deepEqual(
  durableHistoricalInput?.input?.reusableDerivedContinuity,
  cacheA,
  "later cache mutation must not rewrite the historical provider-input universe",
);

const secondFenced = createFencedInferenceOrchestrationDeps({
  execution: generationTwo,
  inferenceExecutionAuthority: authority,
  deps: { specialistDeps },
});
const recovered = await secondFenced.executeSpecialistPlan({ workOrders: [workOrder] });
assert.equal(recovered.status, "completed", JSON.stringify(recovered.failures));
assert.equal(cacheReadCalls, 1, "takeover recovery must make zero reads of current cache B");
assert.equal(bindInputCalls, 1, "takeover must not bind a second input universe");
assert.equal(beginUnknownCalls, 1, "takeover must not reopen UNKNOWN or creative dispatch");
assert.equal(liveContinuityCalls, 1, "takeover must make zero second live Continuity/provider calls");
assert.equal(recoveryCalls, 1, "takeover may recover the exact historical provider response once");
assert.deepEqual(recovered.contributions[0]?.reusableDerivedContinuityConsumed, cacheA, "recovered Continuity must validate against historical cache A, never current cache B");
assert.notDeepEqual(recovered.contributions[0]?.reusableDerivedContinuityConsumed, cacheB);
assert.equal(recovered.metadata[0]?.metadata?.historicalContinuityInputReused, true);

console.log("Movie Mentor Continuity historical-input authority verifier passed.");