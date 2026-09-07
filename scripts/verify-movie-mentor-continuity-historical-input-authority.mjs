import assert from "node:assert/strict";
import { createFencedInferenceOrchestrationDeps } from "../ai/MovieMentorTurnRuntime.js";

const execution = Object.freeze({
  authorized: true,
  executionAuthorized: true,
  executionId: "execution-continuity-input",
  ownerId: "worker-generation-one",
  leaseGeneration: 1,
  leaseReference: "lease-generation-one",
  fencingToken: "fence-generation-one",
});

const call = Object.freeze({
  authorized: true,
  dispatchAuthorized: true,
  providerCallId: "provider-call-continuity-input-one",
  executionId: execution.executionId,
  slotId: "continuity",
  task: "movie-mentor-specialist:continuity",
  ownerId: execution.ownerId,
  leaseGeneration: execution.leaseGeneration,
  leaseReference: execution.leaseReference,
  fencingToken: execution.fencingToken,
});

const cacheA = Object.freeze([{ constraintId: "constraint-a", category: "location", key: "hero.location", value: "harbour", reason: "established", confidence: 1, dependencies: [] }]);
const cacheB = Object.freeze([{ constraintId: "constraint-b", category: "location", key: "hero.location", value: "tower", reason: "later cache", confidence: 1, dependencies: [] }]);

let durableHistoricalInput = null;
let bindInputCalls = 0;
let beginUnknownCalls = 0;
let liveContinuityCalls = 0;
let activeCache = cacheA;

const authority = {
  async claimProviderCall({ slotId, task } = {}) {
    assert.equal(slotId, "continuity");
    assert.equal(task, "movie-mentor-specialist:continuity");
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
    currentCreatorTruth: [],
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

const fenced = createFencedInferenceOrchestrationDeps({
  execution,
  inferenceExecutionAuthority: authority,
  deps: {
    specialistDeps: {
      async readReusableContinuityDerivedCache() {
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
          creatorConfirmedContext: [],
        });
      },
    },
  },
});

const first = await fenced.executeSpecialistPlan({ workOrders: [workOrder] });
assert.equal(first.status, "completed");
assert.equal(bindInputCalls, 1);
assert.equal(beginUnknownCalls, 1);
assert.equal(liveContinuityCalls, 1);
assert.deepEqual(durableHistoricalInput?.input?.reusableDerivedContinuity, cacheA);

// Simulate later cache drift after generation-one dies. Historical operation truth must still say cache A.
activeCache = cacheB;
assert.deepEqual(
  durableHistoricalInput?.input?.reusableDerivedContinuity,
  cacheA,
  "later cache mutation must not rewrite the historical provider-input universe",
);

console.log("Movie Mentor Continuity historical-input authority verifier passed.");
