import assert from "node:assert/strict";
import { createMovieMentorProviderOperationAuthority } from "../ai/MovieMentorProviderOperationAuthority.js";
import { executeStructuredAI } from "../ai/StructuredAIProviderClient.js";

const clone = (value) => value == null ? value : structuredClone(value);
let durable = null;
const store = {
  async readOperation(providerCallId) {
    return durable?.providerCallId === providerCallId ? clone(durable) : null;
  },
  async bindOperation(input) {
    if (!durable) durable = clone(input);
    return clone(durable);
  },
};

const providerCall = Object.freeze({
  dispatchAuthorized: true,
  providerCallId: "provider-call-null-model-authority",
  executionId: "execution-null-model-authority",
  slotId: "semantic",
  task: "movie-mentor-semantic",
  ownerId: "owner-null-model-authority",
  leaseGeneration: 1,
  leaseReference: "lease-null-model-authority",
  fencingToken: "fence-null-model-authority",
});

const originalFetch = globalThis.fetch;
const envKeys = ["IBAND_AI_PROVIDER", "IBAND_AI_MODEL", "IBAND_AI_BASE_URL", "IBAND_AI_API_KEY", "OPENAI_API_KEY"];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
let networkCalls = 0;

try {
  process.env.IBAND_AI_PROVIDER = "generic-http";
  delete process.env.IBAND_AI_MODEL;
  process.env.IBAND_AI_BASE_URL = "https://generic-null-model.example.test/inference";
  delete process.env.IBAND_AI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  const authority = createMovieMentorProviderOperationAuthority({ store });
  const bound = await authority.bindOperation({ providerCall });
  assert.equal(bound.authorized, true);
  assert.equal(bound.providerModel, null, "generic HTTP may intentionally bind an absent model as its exact operation identity");

  const current = await authority.assertCurrentTarget({ providerCall });
  assert.equal(current.dispatchAuthorized, true);
  assert.equal(current.currentModelVerified, true);
  assert.equal(current.providerModel, null);
  assert.equal(current.providerTarget.dispatchModel, null);

  globalThis.fetch = async () => {
    networkCalls += 1;
    return new Response(JSON.stringify({ structured: { ok: true }, model: "generic-drifted-model" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  process.env.IBAND_AI_MODEL = "generic-drifted-model";

  await assert.rejects(
    executeStructuredAI({
      task: "movie-mentor-semantic",
      systemInstructions: "Return structured output.",
      input: { proof: true },
      schema: {
        type: "object",
        additionalProperties: false,
        properties: { ok: { type: "boolean" } },
        required: ["ok"],
      },
      providerOperation: {
        providerOperationId: current.providerOperationId,
        executionId: current.executionId,
        slotId: current.slotId,
        task: current.task,
        providerTarget: current.providerTarget,
      },
    }),
    (error) => {
      assert.equal(error?.code, "AI_PROVIDER_OPERATION_MODEL_AUTHORITY_INVALID");
      assert.equal(error?.retryable, false);
      return true;
    },
    "an explicitly authorized null model must remain authoritative through the provider socket boundary",
  );

  assert.equal(networkCalls, 0, "null-to-non-null model drift must fail before irreversible generic provider I/O");
} finally {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
}

console.log("✓ explicit null-model authority survives the runtime envelope as an owned fact rather than disappearing into absence");
console.log("✓ null-to-model drift is fenced before generic provider network I/O");
console.log("LAW: NULL MAY BE THE AUTHORIZED VALUE. ABSENCE OF PROOF IS NOT THE SAME THING.");
console.log("Movie Mentor provider null-model authority gate: GREEN");
