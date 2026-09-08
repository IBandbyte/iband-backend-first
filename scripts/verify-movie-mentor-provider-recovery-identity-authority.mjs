import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createFencedInferenceOrchestrationDeps } from "../ai/MovieMentorTurnRuntime.js";
import {
  createMovieMentorProviderOperationAuthority,
  createMovieMentorProviderOperationBoundaryAuthority,
} from "../ai/MovieMentorProviderOperationAuthority.js";
import { fingerprintMovieMentorProviderRoute } from "../ai/MovieMentorProviderTargetAuthority.js";

const originalFetch = globalThis.fetch;
const envKeys = ["IBAND_AI_PROVIDER", "IBAND_AI_MODEL", "IBAND_AI_BASE_URL", "IBAND_AI_API_KEY", "OPENAI_API_KEY"];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

function restoreEnvironment() {
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  globalThis.fetch = originalFetch;
}

function canonicalize(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function digest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

const authorizedRoute = "https://provider.example.test/v1/responses?tenant=recovery-proof&mode=strict";
const expectedTarget = Object.freeze({
  provider: "openai",
  adapter: "openai-responses",
  routeFingerprint: fingerprintMovieMentorProviderRoute("openai", authorizedRoute),
  recoveryMode: "known-response-id-retrieval",
});

const validSemantic = {
  understoodContext: [],
  provisionalContext: [],
  unresolvedContext: [],
  clarificationNeeded: [],
  readyToAdvance: true,
  recommendedStageId: null,
  recommendedTaskId: null,
  nextAction: null,
  resumeNote: null,
};

try {
  process.env.IBAND_AI_PROVIDER = "openai";
  process.env.IBAND_AI_MODEL = "gpt-test";
  process.env.IBAND_AI_BASE_URL = authorizedRoute;
  process.env.IBAND_AI_API_KEY = "test-key";

  const operationRows = new Map();
  const operationStore = {
    async readOperation(providerCallId) {
      return clone(operationRows.get(providerCallId) || null);
    },
    async bindOperation(input) {
      const existing = operationRows.get(input.providerCallId);
      if (existing) return clone(existing);
      const row = clone(input);
      operationRows.set(input.providerCallId, row);
      return clone(row);
    },
    async bindReconstructionInput(input) {
      const existing = operationRows.get(input.providerCallId);
      assert.ok(existing, "provider operation identity must exist before its reconstruction input can bind");
      if (existing.reconstructionInputDigest) return clone(existing);
      const row = {
        ...existing,
        reconstructionInputDigest: input.reconstructionInputDigest,
        reconstructionInput: clone(input.reconstructionInput),
        reconstructionInputBoundAt: input.boundAt,
      };
      operationRows.set(input.providerCallId, row);
      return clone(row);
    },
  };

  let effectBeginCount = 0;
  const providerEffectAuthority = {
    async beginDispatch({ providerCall }) {
      effectBeginCount += 1;
      const row = operationRows.get(providerCall.providerCallId);
      assert.ok(row, "durable provider target identity must exist before UNKNOWN is created");
      assert.ok(row.reconstructionInputDigest, "durable historical task input must exist before UNKNOWN is created");
      assert.ok(row.reconstructionInput !== undefined && row.reconstructionInput !== null, "historical task input payload must survive before UNKNOWN");
      return { authorized: true, dispatchAuthorized: true, effectState: "unknown" };
    },
    async contributeEvidence() {
      return { accepted: true, state: "confirmed" };
    },
  };

  const leaseAuthority = {
    async assertProviderDispatch() {
      return { authorized: true, dispatchAuthorized: true };
    },
  };

  const operationAuthority = createMovieMentorProviderOperationAuthority({ store: operationStore });
  const boundaryAuthority = createMovieMentorProviderOperationBoundaryAuthority({
    leaseAuthority,
    providerEffectAuthority,
    providerOperationAuthority: operationAuthority,
  });

  const providerCall = Object.freeze({
    authorized: true,
    dispatchAuthorized: true,
    projectId: "project-provider-recovery-proof",
    principalId: "creator-provider-recovery-proof",
    creatorTurnId: "turn-provider-recovery-proof",
    reservationId: "reservation-provider-recovery-proof",
    requestDigest: "request-provider-recovery-proof",
    providerCallId: "provider-call-provider-recovery-proof",
    executionId: "execution-provider-recovery-proof",
    slotId: "semantic",
    task: "movie-mentor-semantic",
    ownerId: "worker-provider-recovery-proof",
    leaseGeneration: 1,
    leaseReference: "lease-provider-recovery-proof",
    fencingToken: "fence-provider-recovery-proof",
    admittedAt: "2031-01-01T00:00:00.000Z",
  });

  const runtimeAuthority = {
    async claimProviderCall() {
      return providerCall;
    },
    bindProviderReconstructionInput: operationAuthority.bindReconstructionInput,
    beginProviderDispatch: boundaryAuthority.beginProviderDispatch,
    assertProviderDispatch: boundaryAuthority.assertProviderDispatch,
    contributeProviderEffectEvidence: providerEffectAuthority.contributeEvidence,
  };

  let socketOpened = false;
  globalThis.fetch = async () => {
    socketOpened = true;
    return new Response(JSON.stringify({
      id: "resp-provider-recovery-identity-proof",
      model: "gpt-test",
      output_text: JSON.stringify(validSemantic),
      usage: { total_tokens: 1 },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const semanticInput = {
    message: "A lighthouse sends messages from a missing daughter.",
    context: { creatorConfirmedContext: [] },
  };
  const fenced = createFencedInferenceOrchestrationDeps({
    execution: { authorized: true },
    inferenceExecutionAuthority: runtimeAuthority,
  });

  const result = await fenced.interpretSemantics(semanticInput);

  assert.equal(result.structured.movieJourneyIntelligence.readyToAdvance, true);
  assert.equal(socketOpened, true, "verifier must reach the real OpenAI-shaped network boundary after durable recovery identity is established");
  assert.equal(effectBeginCount, 1);

  const durableOperation = await operationAuthority.readOperation(providerCall.providerCallId);
  assert.deepEqual(durableOperation.providerTarget, expectedTarget, "historical provider operation must durably preserve the exact secret-free provider target that owned it");
  assert.equal(durableOperation.reconstructionInputDigest, digest(semanticInput), "exact semantic input must be immutably digested before UNKNOWN");
  assert.deepEqual(durableOperation.reconstructionInput, semanticInput, "exact semantic input must survive with the historical provider operation");
  assert.equal(JSON.stringify(durableOperation).includes("tenant=recovery-proof"), false, "durable provider recovery identity must retain query authority only through its fingerprint, not persist raw query material");
  assert.equal(JSON.stringify(durableOperation).includes("mode=strict"), false, "durable provider recovery identity must not persist raw query material");

  process.env.IBAND_AI_BASE_URL = "https://provider.example.test/v1/responses?tenant=other&mode=strict";
  const changedTargetDecision = await boundaryAuthority.assertProviderDispatch({ providerCall });
  assert.equal(changedTargetDecision.dispatchAuthorized, false);
  assert.equal(changedTargetDecision.reason, "provider-target-no-longer-current");
  assert.deepEqual((await operationAuthority.readOperation(providerCall.providerCallId)).providerTarget, expectedTarget, "current configuration changes must not rewrite historical provider recovery identity");

  console.log("✓ live provider dispatch binds immutable durable-safe provider target identity before UNKNOWN");
  console.log("✓ exact historical task input is durably bound before UNKNOWN and survives with the provider operation");
  console.log("✓ the real OpenAI-shaped socket opens only after target identity + historical input + UNKNOWN + lease authority agree");
  console.log("✓ historical provider target survives query-only configuration change and current config cannot impersonate it");
  console.log("✓ provider query participates in route authority without persisting raw query material in durable recovery identity");
  console.log("LAW: CURRENT PROVIDER CONFIGURATION MAY NOT IMPERSONATE THE HISTORICAL PROVIDER OPERATION.");
  console.log("LAW: RECOVERY AUTHORITY REQUIRES DURABLE PROVIDER TARGET IDENTITY AND EXACT HISTORICAL TASK INPUT BEFORE THE IRREVERSIBLE BOUNDARY.");
  console.log("Movie Mentor provider recovery identity authority gate: GREEN");
} finally {
  restoreEnvironment();
}
