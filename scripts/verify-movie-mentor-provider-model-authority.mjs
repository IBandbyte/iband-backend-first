import assert from "node:assert/strict";
import { createMovieMentorProviderOperationAuthority } from "../ai/MovieMentorProviderOperationAuthority.js";
import { executeStructuredAI } from "../ai/StructuredAIProviderClient.js";

function clone(value) {
  return value == null ? value : structuredClone(value);
}

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
  providerCallId: "provider-call-model-authority",
  executionId: "execution-model-authority",
  slotId: "semantic",
  task: "movie-mentor-semantic",
  ownerId: "owner-model-authority",
  leaseGeneration: 1,
  leaseReference: "lease-model-authority",
  fencingToken: "fence-model-authority",
});

const originalFetch = globalThis.fetch;
const envKeys = ["IBAND_AI_PROVIDER", "IBAND_AI_MODEL", "IBAND_AI_BASE_URL", "IBAND_AI_API_KEY", "OPENAI_API_KEY"];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
let networkCalls = 0;
let observedModel = null;

try {
  process.env.IBAND_AI_PROVIDER = "openai";
  process.env.IBAND_AI_MODEL = "model-authorized-a";
  process.env.IBAND_AI_BASE_URL = "https://provider-model-authority.example.test/v1/responses";
  process.env.IBAND_AI_API_KEY = "test-key";

  const authority = createMovieMentorProviderOperationAuthority({ store });
  const bound = await authority.bindOperation({ providerCall });
  assert.equal(bound.authorized, true);

  process.env.IBAND_AI_MODEL = "model-drifted-b";

  const current = await authority.assertCurrentTarget({ providerCall });
  assert.equal(
    current.dispatchAuthorized,
    false,
    "provider dispatch authority must be revoked when the configured model differs from the model durably bound to the admitted operation",
  );
  assert.equal(current.reason, "provider-model-no-longer-current");

  globalThis.fetch = async (_url, options = {}) => {
    networkCalls += 1;
    observedModel = JSON.parse(options.body || "{}").model || null;
    return new Response(JSON.stringify({
      id: "resp_model_authority",
      model: observedModel,
      output_text: JSON.stringify({ ok: true }),
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  if (current.dispatchAuthorized === true) {
    await executeStructuredAI({
      task: "movie-mentor-semantic",
      systemInstructions: "Return structured output.",
      input: { story: "same durable input" },
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
        providerModel: current.providerModel,
      },
    });
  }

  assert.equal(networkCalls, 0, "model drift must be fenced before irreversible provider network I/O");
  assert.equal(observedModel, null);
} finally {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
}

console.log("✓ durable provider operation owns the exact inference model before network I/O");
console.log("LAW: SAME ROUTE DOES NOT MEAN SAME OPERATION WHEN THE MODEL CHANGES.");
console.log("Movie Mentor provider model authority gate: GREEN");
