import assert from "node:assert/strict";
import { createFencedInferenceOrchestrationDeps } from "../ai/MovieMentorTurnRuntime.js";

console.log("Movie Mentor specialist provider-effect evidence authority court");

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

const responseId = "resp-specialist-domain-invalid";
const invalidButSchemaValidContribution = Object.freeze({
  agentId: "story",
  observations: [],
  provisionalSuggestions: [],
  risksAndConflicts: [],
  creatorConfirmedDependencies: [
    { key: "villain.name", value: "Mara" },
  ],
  continuationObedienceClaims: [],
  confidence: 0.8,
  provenance: {
    source: "provider",
    model: "gpt-test",
    contractVersion: "provider-contract",
  },
});

globalThis.fetch = async () => new Response(JSON.stringify({
  id: responseId,
  model: "gpt-test",
  output_text: JSON.stringify(invalidButSchemaValidContribution),
  usage: { total_tokens: 1 },
}), {
  status: 200,
  headers: { "Content-Type": "application/json" },
});

const execution = Object.freeze({
  authorized: true,
  executionId: "execution-specialist-evidence",
});

const providerCall = Object.freeze({
  authorized: true,
  dispatchAuthorized: true,
  projectId: "project-specialist-evidence",
  principalId: "creator-specialist-evidence",
  creatorTurnId: "turn-specialist-evidence",
  reservationId: "reservation-specialist-evidence",
  requestDigest: "request-specialist-evidence",
  providerCallId: "provider-call-specialist-evidence",
  executionId: execution.executionId,
  slotId: "story",
  task: "movie-mentor-specialist:story",
  ownerId: "worker-specialist-evidence",
  leaseGeneration: 1,
  leaseReference: "lease-specialist-evidence",
  fencingToken: "fence-specialist-evidence",
  admittedAt: "2032-01-01T00:00:00.000Z",
});

const contributedEvidence = [];
const authority = Object.freeze({
  async claimProviderCall({ slotId, task }) {
    assert.equal(slotId, providerCall.slotId);
    assert.equal(task, providerCall.task);
    return providerCall;
  },
  async bindProviderReconstructionInput({ providerCall: call, reconstructionInput }) {
    assert.equal(call.providerCallId, providerCall.providerCallId);
    assert.equal(reconstructionInput.agentId, "story");
    return Object.freeze({ authorized: true, inputBound: true, providerCallId: call.providerCallId });
  },
  async beginProviderDispatch({ providerCall: call }) {
    assert.equal(call.providerCallId, providerCall.providerCallId);
    return Object.freeze({ dispatchAuthorized: true, providerCallId: call.providerCallId });
  },
  async assertProviderDispatch({ providerCall: call }) {
    assert.equal(call.providerCallId, providerCall.providerCallId);
    return Object.freeze({ dispatchAuthorized: true, providerCallId: call.providerCallId });
  },
  async contributeProviderEffectEvidence(evidence) {
    contributedEvidence.push(structuredClone(evidence));
    return Object.freeze({ accepted: true });
  },
});

const workOrder = Object.freeze({
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
    creatorConfirmedContext: Object.freeze([
      Object.freeze({ key: "hero.name", value: "Ari" }),
    ]),
    projectJourney: null,
    continuationObedienceEnvelope: Object.freeze({ references: [], requiredReferenceIds: [] }),
  }),
});

try {
  const fenced = createFencedInferenceOrchestrationDeps({
    execution,
    inferenceExecutionAuthority: authority,
  });

  const result = await fenced.executeSpecialistPlan({ workOrders: [workOrder] });

  assert.equal(result.status, "partial", "domain-invalid specialist output must still fail local authority validation");
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].code, "SPECIALIST_CONTRIBUTION_INVALID");
  assert.equal(result.contributions.length, 0);
  assert.deepEqual(
    contributedEvidence,
    [{
      providerCallId: providerCall.providerCallId,
      externalEffectId: responseId,
      provider: "openai",
      source: "provider-error-evidence",
    }],
    "known provider response identity must survive post-provider specialist authority rejection into durable effect evidence",
  );

  console.log("✓ provider response may lose result authority without losing provider-effect identity");
  console.log("✓ schema-valid but domain-invalid specialist output remains rejected");
  console.log("✓ post-provider specialist authority failure contributes the exact known response ID");
  console.log("LAW: LOCAL SPECIALIST REJECTION MAY REVOKE RESULT AUTHORITY. IT MAY NOT ERASE PROVIDER-EFFECT EVIDENCE.");
  console.log("Movie Mentor specialist provider-effect evidence authority: GREEN");
} finally {
  globalThis.fetch = previousFetch;
  if (previousEnv.provider === undefined) delete process.env.IBAND_AI_PROVIDER; else process.env.IBAND_AI_PROVIDER = previousEnv.provider;
  if (previousEnv.model === undefined) delete process.env.IBAND_AI_MODEL; else process.env.IBAND_AI_MODEL = previousEnv.model;
  if (previousEnv.baseUrl === undefined) delete process.env.IBAND_AI_BASE_URL; else process.env.IBAND_AI_BASE_URL = previousEnv.baseUrl;
  if (previousEnv.key === undefined) delete process.env.IBAND_AI_API_KEY; else process.env.IBAND_AI_API_KEY = previousEnv.key;
}
