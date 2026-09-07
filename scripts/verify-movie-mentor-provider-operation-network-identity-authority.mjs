import assert from "node:assert/strict";
import { executeStructuredAI } from "../ai/StructuredAIProviderClient.js";
import { interpretMovieMentorSemantics } from "../ai/MovieMentorSemanticInterpreter.js";
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

function installOpenAIEnvironment() {
  process.env.IBAND_AI_PROVIDER = "openai";
  process.env.IBAND_AI_MODEL = "gpt-test";
  process.env.IBAND_AI_BASE_URL = "https://provider.example.test/v1/responses";
  process.env.IBAND_AI_API_KEY = "test-key";
}

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

function response(id, structured) {
  return new Response(JSON.stringify({
    id,
    model: "gpt-test",
    output_text: JSON.stringify(structured),
    usage: { total_tokens: 1 },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

function idempotencyHeader(options = {}) {
  const headers = options?.headers || {};
  return headers["Idempotency-Key"] || headers["idempotency-key"] || null;
}

try {
  installOpenAIEnvironment();

  const operation = Object.freeze({
    providerOperationId: "provider-call-network-proof",
    executionId: "execution-network-proof",
    slotId: "semantic",
    task: "movie-mentor-semantic",
  });

  let sharedHeader = null;
  globalThis.fetch = async (_url, options) => {
    sharedHeader = idempotencyHeader(options);
    return response("resp-shared-network-proof", { value: "ok" });
  };

  const shared = await executeStructuredAI({
    task: "movie-mentor-network-proof",
    systemInstructions: "Return the required schema.",
    input: { proof: true },
    schema: {
      type: "object",
      additionalProperties: false,
      properties: { value: { type: "string" } },
      required: ["value"],
    },
    schemaName: "movie_mentor_network_operation_identity",
    providerOperation: operation,
  });
  assert.equal(shared.structured.value, "ok");
  assert.equal(
    sharedHeader,
    operation.providerOperationId,
    "the shared OpenAI socket must carry the exact durable Movie Mentor provider operation ID as the provider idempotency key",
  );

  let semanticHeader = null;
  globalThis.fetch = async (_url, options) => {
    semanticHeader = idempotencyHeader(options);
    return response("resp-semantic-network-proof", validSemantic);
  };

  const semantic = await interpretMovieMentorSemantics({
    message: "A lighthouse sends messages from a missing daughter.",
    context: { creatorConfirmedContext: [] },
  }, { providerOperation: operation });
  assert.equal(semantic.structured.movieJourneyIntelligence.readyToAdvance, true);
  assert.equal(
    semanticHeader,
    operation.providerOperationId,
    "the independent semantic OpenAI socket must carry the exact durable Movie Mentor provider operation ID as the provider idempotency key",
  );

  let runtimeOperation = null;
  const providerCall = Object.freeze({
    authorized: true,
    dispatchAuthorized: true,
    projectId: "project-network-proof",
    principalId: "creator-network-proof",
    creatorTurnId: "turn-network-proof",
    reservationId: "reservation-network-proof",
    requestDigest: "request-network-proof",
    providerCallId: "provider-call-runtime-network-proof",
    executionId: "execution-runtime-network-proof",
    slotId: "semantic",
    task: "movie-mentor-semantic",
    ownerId: "worker-network-proof",
    leaseGeneration: 1,
    leaseReference: "lease-network-proof",
    fencingToken: "fence-network-proof",
    admittedAt: "2031-01-01T00:00:00.000Z",
  });
  const runtimeAuthority = {
    async claimProviderCall() { return providerCall; },
    async beginProviderDispatch() { return { authorized: true, dispatchAuthorized: true, effectState: "unknown" }; },
    async assertProviderDispatch() { return { authorized: true, dispatchAuthorized: true }; },
    async contributeProviderEffectEvidence() { return { accepted: true, state: "confirmed" }; },
  };
  const fenced = createFencedInferenceOrchestrationDeps({
    execution: { authorized: true },
    inferenceExecutionAuthority: runtimeAuthority,
    deps: {
      interpretSemantics: async (_input, context = {}) => {
        runtimeOperation = context.providerOperation || null;
        return {
          structured: { movieJourneyIntelligence: validSemantic },
          metadata: { provider: "openai", responseId: "resp-runtime-network-proof" },
        };
      },
    },
  });
  await fenced.interpretSemantics({ proof: true });
  assert.deepEqual(
    runtimeOperation,
    {
      providerOperationId: providerCall.providerCallId,
      executionId: providerCall.executionId,
      slotId: providerCall.slotId,
      task: providerCall.task,
    },
    "runtime must hand the exact durable provider-call identity across the provider invocation boundary rather than stopping one layer before the network client",
  );

  console.log("✓ shared OpenAI transport carries exact durable Movie Mentor operation identity");
  console.log("✓ independent semantic OpenAI transport carries exact durable Movie Mentor operation identity");
  console.log("✓ fenced runtime transports exact provider-call identity into the provider adapter boundary");
  console.log("LAW: AN INTERNAL IDEMPOTENCY ID THAT STOPS BEFORE THE NETWORK SOCKET IS NOT PROVIDER IDEMPOTENCY.");
  console.log("LAW: MOVIE MENTOR OPERATION IDENTITY MUST CROSS THE IRREVERSIBLE PROVIDER BOUNDARY.");
  console.log("Movie Mentor provider operation network identity authority gate: GREEN");
} finally {
  restoreEnvironment();
}
