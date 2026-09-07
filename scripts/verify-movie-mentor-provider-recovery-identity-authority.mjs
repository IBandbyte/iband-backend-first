import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createFencedInferenceOrchestrationDeps } from "../ai/MovieMentorTurnRuntime.js";

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

function routeFingerprint(provider, url) {
  const parsed = new URL(url);
  parsed.username = "";
  parsed.password = "";
  parsed.search = "";
  parsed.hash = "";
  return crypto.createHash("sha256").update(`${provider}|${parsed.toString()}`).digest("hex");
}

const expectedTarget = Object.freeze({
  provider: "openai",
  adapter: "openai-responses",
  routeFingerprint: routeFingerprint("openai", "https://provider.example.test/v1/responses"),
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
  process.env.IBAND_AI_BASE_URL = "https://provider.example.test/v1/responses?transient_secret=must-not-be-durable";
  process.env.IBAND_AI_API_KEY = "test-key";

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

  let capturedClaim = null;
  let capturedDispatch = null;
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
    providerTarget: expectedTarget,
  });

  const runtimeAuthority = {
    async claimProviderCall(input) {
      capturedClaim = structuredClone(input);
      return providerCall;
    },
    async beginProviderDispatch(input) {
      capturedDispatch = structuredClone(input);
      return { authorized: true, dispatchAuthorized: true, effectState: "unknown" };
    },
    async assertProviderDispatch() {
      return { authorized: true, dispatchAuthorized: true };
    },
    async contributeProviderEffectEvidence() {
      return { accepted: true, state: "confirmed" };
    },
  };

  const fenced = createFencedInferenceOrchestrationDeps({
    execution: { authorized: true },
    inferenceExecutionAuthority: runtimeAuthority,
  });

  const result = await fenced.interpretSemantics({
    message: "A lighthouse sends messages from a missing daughter.",
    context: { creatorConfirmedContext: [] },
  });

  assert.equal(result.structured.movieJourneyIntelligence.readyToAdvance, true);
  assert.equal(socketOpened, true, "verifier must reach the real OpenAI-shaped network boundary before judging provider recovery identity");
  assert.deepEqual(
    capturedClaim?.providerTarget,
    expectedTarget,
    "provider-call admission must bind the exact durable-safe provider target before UNKNOWN and before the irreversible socket",
  );
  assert.deepEqual(
    capturedDispatch?.providerCall?.providerTarget,
    expectedTarget,
    "UNKNOWN-before-network authority must preserve the exact provider target admitted for this historical operation",
  );
  assert.equal(
    JSON.stringify(capturedClaim).includes("transient_secret"),
    false,
    "durable provider recovery identity must not persist URL query secrets",
  );

  console.log("✓ live provider admission binds durable-safe provider target identity before UNKNOWN");
  console.log("✓ UNKNOWN authority preserves the exact provider target that owns the historical operation");
  console.log("✓ provider route identity excludes URL query credentials and transient secrets");
  console.log("LAW: CURRENT PROVIDER CONFIGURATION MAY NOT IMPERSONATE THE HISTORICAL PROVIDER OPERATION.");
  console.log("LAW: RECOVERY AUTHORITY REQUIRES DURABLE PROVIDER TARGET IDENTITY BEFORE THE IRREVERSIBLE BOUNDARY.");
  console.log("Movie Mentor provider recovery identity authority gate: GREEN");
} finally {
  restoreEnvironment();
}
