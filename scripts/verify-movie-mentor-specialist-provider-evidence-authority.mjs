import assert from "node:assert/strict";
import { createFencedInferenceOrchestrationDeps } from "../ai/MovieMentorTurnRuntime.js";
import { buildContinuationObedienceEnvelope } from "../ai/MovieMentorContinuationObedienceControl.js";
import { DERIVED_CONTINUITY_AUTHORITY } from "../ai/MovieMentorContinuityConsequenceAuthority.js";

console.log("Movie Mentor post-provider domain-rejection evidence authority court");

const previousEnv = {
  provider: process.env.IBAND_AI_PROVIDER,
  model: process.env.IBAND_AI_MODEL,
  baseUrl: process.env.IBAND_AI_BASE_URL,
  key: process.env.IBAND_AI_API_KEY,
};
const previousFetch = globalThis.fetch;

process.env.IBAND_AI_PROVIDER = "openai";
process.env.IBAND_AI_MODEL = "gpt-test";
process.env.IBAND_AI_BASE_URL = "https://provider.invalid/v1/responses";
process.env.IBAND_AI_API_KEY = "test-key";

const responses = [
  {
    id: "resp-specialist-domain-invalid",
    structured: {
      agentId: "story",
      observations: [],
      provisionalSuggestions: [],
      risksAndConflicts: [],
      creatorConfirmedDependencies: [{ key: "villain.name", value: "Mara" }],
      continuationObedienceClaims: [],
      confidence: 0.8,
      provenance: { source: "provider", model: "gpt-test", contractVersion: "provider-contract" },
    },
  },
  {
    id: "resp-continuity-domain-invalid",
    structured: {
      agentId: "continuity",
      derivedConstraints: [{
        category: "timeline",
        key: "hero.age",
        value: "40",
        reason: "Derived from an unproven dependency.",
        confidence: 0.9,
        dependencies: [{ key: "hero.birthYear", value: "1992" }],
      }],
      continuityConflicts: [],
      unresolvedContinuityQuestions: [],
      provisionalSuggestions: [],
      confidence: 0.9,
      provenance: { source: "provider", model: "gpt-test", contractVersion: "provider-contract" },
    },
  },
  {
    id: "resp-synthesis-domain-invalid",
    structured: {
      text: "Continue with the established choice.",
      usedContributionAgentIds: [],
      deferredContributionAgentIds: [],
      continuationObedienceClaims: [],
      conflictsHandled: [],
      confidence: 0.9,
      provenance: { source: "provider", model: "gpt-test", contractVersion: "provider-contract" },
    },
  },
];
let responseIndex = 0;
globalThis.fetch = async () => {
  const next = responses[responseIndex++];
  assert.ok(next, "each admitted provider task must consume exactly one fake provider response");
  return new Response(JSON.stringify({
    id: next.id,
    model: "gpt-test",
    output_text: JSON.stringify(next.structured),
    usage: { total_tokens: 1 },
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

const execution = Object.freeze({
  authorized: true,
  executionId: "execution-post-provider-evidence",
});

const contributedEvidence = [];
const calls = new Map();
function providerCall(slotId, task) {
  const key = `${slotId}:${task}`;
  if (!calls.has(key)) {
    calls.set(key, Object.freeze({
      authorized: true,
      dispatchAuthorized: true,
      projectId: "project-post-provider-evidence",
      principalId: "creator-post-provider-evidence",
      creatorTurnId: "turn-post-provider-evidence",
      reservationId: "reservation-post-provider-evidence",
      requestDigest: "request-post-provider-evidence",
      providerCallId: `provider-call-${slotId}-post-provider-evidence`,
      executionId: execution.executionId,
      slotId,
      task,
      ownerId: "worker-post-provider-evidence",
      leaseGeneration: 1,
      leaseReference: "lease-post-provider-evidence",
      fencingToken: "fence-post-provider-evidence",
      admittedAt: "2032-01-01T00:00:00.000Z",
    }));
  }
  return calls.get(key);
}

const authority = Object.freeze({
  async claimProviderCall({ slotId, task }) {
    return providerCall(slotId, task);
  },
  async bindProviderReconstructionInput({ providerCall: call, reconstructionInput }) {
    assert.equal(call.executionId, execution.executionId);
    assert.notEqual(reconstructionInput, undefined);
    return Object.freeze({ authorized: true, inputBound: true, providerCallId: call.providerCallId });
  },
  async beginProviderDispatch({ providerCall: call }) {
    return Object.freeze({ dispatchAuthorized: true, providerCallId: call.providerCallId });
  },
  async assertProviderDispatch({ providerCall: call }) {
    return Object.freeze({ dispatchAuthorized: true, providerCallId: call.providerCallId });
  },
  async contributeProviderEffectEvidence(evidence) {
    contributedEvidence.push(structuredClone(evidence));
    return Object.freeze({ accepted: true });
  },
});

const storyWorkOrder = Object.freeze({
  agentId: "story",
  creatorFacing: false,
  mayAdvanceJourney: false,
  mayOverwriteCreatorTruth: false,
  authority: "mentor-provisional",
  purpose: "prove post-provider specialist validation preserves effect identity",
  input: Object.freeze({
    stageId: "stage-1",
    taskId: "task-1",
    creatorMessage: "Keep the hero focused on getting home.",
    semanticIntelligence: Object.freeze({}),
    creatorConfirmedContext: Object.freeze([Object.freeze({ key: "hero.name", value: "Ari" })]),
    projectJourney: null,
    continuationObedienceEnvelope: Object.freeze({ references: [], requiredReferenceIds: [] }),
  }),
});

const continuityWorkOrder = Object.freeze({
  agentId: "continuity",
  creatorFacing: false,
  mayAdvanceJourney: false,
  mayOverwriteCreatorTruth: false,
  mayCreateCanon: false,
  authority: "mentor-provisional",
  purpose: "prove post-provider Continuity validation preserves effect identity",
  input: Object.freeze({
    creatorMessage: "Keep the timeline consistent.",
    semanticIntelligence: Object.freeze({}),
    currentCreatorTruth: Object.freeze([]),
    reusableDerivedContinuity: Object.freeze([]),
    projectJourney: null,
    memoryContext: null,
    currentScene: null,
    previousScenes: Object.freeze([]),
    stageId: "stage-1",
    taskId: "task-continuity",
  }),
});

const continuationEnvelope = buildContinuationObedienceEnvelope({
  continuationReferences: [{
    status: "resolved",
    referenceId: "reference-1",
    expression: "the blue door",
    resolvedValue: "the creator-confirmed blue door",
    material: true,
  }],
});
const synthesisInput = Object.freeze({
  creatorMessage: "Continue from the blue door choice.",
  creatorConfirmedContext: Object.freeze([]),
  semanticIntelligence: Object.freeze({ clarificationNeeded: [] }),
  contributions: Object.freeze([]),
  continuityConsequenceEnvelope: Object.freeze({
    status: "consistent",
    requiresClarification: false,
    authority: DERIVED_CONTINUITY_AUTHORITY,
    constraints: Object.freeze([]),
  }),
  continuationObedienceEnvelope: Object.freeze(continuationEnvelope),
});

try {
  const fenced = createFencedInferenceOrchestrationDeps({
    execution,
    inferenceExecutionAuthority: authority,
  });

  const story = await fenced.executeSpecialistPlan({ workOrders: [storyWorkOrder] });
  assert.equal(story.status, "partial", "domain-invalid Story output must still fail local authority validation");
  assert.equal(story.failures.length, 1);
  assert.equal(story.failures[0].code, "SPECIALIST_CONTRIBUTION_INVALID");
  assert.equal(story.contributions.length, 0);

  const continuity = await fenced.executeSpecialistPlan({ workOrders: [continuityWorkOrder] });
  assert.equal(continuity.status, "partial", "domain-invalid Continuity output must still fail local authority validation");
  assert.equal(continuity.failures.length, 1);
  assert.equal(continuity.failures[0].code, "CONTINUITY_CONTRIBUTION_INVALID");
  assert.equal(continuity.contributions.length, 0);

  await assert.rejects(
    () => fenced.synthesizeResponse(synthesisInput),
    (error) => error?.code === "MENTOR_SYNTHESIS_CONTINUATION_OBEDIENCE_FAILED",
    "domain-invalid Synthesis output must still fail local continuation-obedience authority",
  );

  assert.equal(responseIndex, 3, "the court must exercise exactly three irreversible provider responses");
  assert.deepEqual(
    contributedEvidence,
    [
      {
        providerCallId: "provider-call-story-post-provider-evidence",
        externalEffectId: "resp-specialist-domain-invalid",
        provider: "openai",
        source: "provider-error-evidence",
      },
      {
        providerCallId: "provider-call-continuity-post-provider-evidence",
        externalEffectId: "resp-continuity-domain-invalid",
        provider: "openai",
        source: "provider-error-evidence",
      },
      {
        providerCallId: "provider-call-synthesis-post-provider-evidence",
        externalEffectId: "resp-synthesis-domain-invalid",
        provider: "openai",
        source: "provider-error-evidence",
      },
    ],
    "every known provider response identity must survive higher-layer Movie Mentor authority rejection into durable effect evidence",
  );

  console.log("✓ Story/Character-class domain rejection preserves the exact known provider response ID");
  console.log("✓ Continuity domain rejection preserves the exact known provider response ID");
  console.log("✓ Synthesis continuation-obedience rejection preserves the exact known provider response ID");
  console.log("✓ all three invalid local results remain rejected while provider-effect evidence survives");
  console.log("LAW: LOCAL DOMAIN REJECTION MAY REVOKE RESULT AUTHORITY. IT MAY NOT ERASE A KNOWN PROVIDER EFFECT.");
  console.log("Movie Mentor post-provider domain-rejection evidence authority: GREEN");
} finally {
  globalThis.fetch = previousFetch;
  if (previousEnv.provider === undefined) delete process.env.IBAND_AI_PROVIDER; else process.env.IBAND_AI_PROVIDER = previousEnv.provider;
  if (previousEnv.model === undefined) delete process.env.IBAND_AI_MODEL; else process.env.IBAND_AI_MODEL = previousEnv.model;
  if (previousEnv.baseUrl === undefined) delete process.env.IBAND_AI_BASE_URL; else process.env.IBAND_AI_BASE_URL = previousEnv.baseUrl;
  if (previousEnv.key === undefined) delete process.env.IBAND_AI_API_KEY; else process.env.IBAND_AI_API_KEY = previousEnv.key;
}
