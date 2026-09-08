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

try {
  process.env.IBAND_AI_PROVIDER = "openai";
  process.env.IBAND_AI_MODEL = "model-authorized-a";
  process.env.IBAND_AI_BASE_URL = "https://provider-model-authority.example.test/v1/responses";
  process.env.IBAND_AI_API_KEY = "test-key";

  const authority = createMovieMentorProviderOperationAuthority({ store });
  const bound = await authority.bindOperation({ providerCall });
  assert.equal(bound.authorized, true);
  assert.equal(bound.providerModel, "model-authorized-a");

  process.env.IBAND_AI_MODEL = "model-drifted-b";
  const drifted = await authority.assertCurrentTarget({ providerCall });
  assert.equal(
    drifted.dispatchAuthorized,
    false,
    "provider dispatch authority must be revoked when the configured model differs from the model durably bound to the admitted operation",
  );
  assert.equal(drifted.reason, "provider-model-no-longer-current");

  process.env.IBAND_AI_MODEL = "model-authorized-a";
  const current = await authority.assertCurrentTarget({ providerCall });
  assert.equal(current.dispatchAuthorized, true);
  assert.equal(current.currentModelVerified, true);
  assert.equal(current.providerModel, "model-authorized-a");
  assert.equal(current.providerTarget.dispatchModel, "model-authorized-a", "current dispatch proof must carry the exact durable model through the existing runtime transport envelope");

  globalThis.fetch = async () => {
    networkCalls += 1;
    throw new Error("model drift must never reach the network");
  };

  process.env.IBAND_AI_MODEL = "model-drifted-b";
  await assert.rejects(
    executeStructuredAI({
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
        providerModelAuthorityBound: true,
        providerModel: current.providerModel,
      },
    }),
    (error) => {
      assert.equal(error?.code, "AI_PROVIDER_OPERATION_MODEL_AUTHORITY_INVALID");
      assert.equal(error?.retryable, false);
      return true;
    },
    "a model TOCTOU after current-dispatch proof must still fail closed at the provider socket boundary",
  );

  assert.equal(networkCalls, 0, "model drift must be fenced before irreversible provider network I/O");
} finally {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
}

console.log("✓ durable provider operation owns the exact inference model before network I/O");
console.log("✓ current-dispatch proof carries the durable model to the provider socket boundary without changing recovery-route identity");
console.log("✓ model TOCTOU after authority proof fails closed before fetch");
console.log("LAW: SAME ROUTE DOES NOT MEAN SAME OPERATION WHEN THE MODEL CHANGES.");
console.log("Movie Mentor provider model authority gate: GREEN");
