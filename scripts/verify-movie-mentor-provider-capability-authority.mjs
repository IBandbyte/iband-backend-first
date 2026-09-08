import assert from "node:assert/strict";
import { executeStructuredAI } from "../ai/StructuredAIProviderClient.js";
import { describeCurrentMovieMentorProviderTarget } from "../ai/MovieMentorProviderTargetAuthority.js";

const originalFetch = globalThis.fetch;
const envKeys = ["IBAND_AI_PROVIDER", "IBAND_AI_MODEL", "IBAND_AI_BASE_URL", "IBAND_AI_API_KEY", "OPENAI_API_KEY"];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
function restore() {
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  globalThis.fetch = originalFetch;
}

const schema = { type: "object", additionalProperties: false, properties: { value: { type: "string" } }, required: ["value"] };

try {
  process.env.IBAND_AI_PROVIDER = "openai";
  process.env.IBAND_AI_MODEL = "authorized-model";
  process.env.IBAND_AI_BASE_URL = "https://provider.example.test/v1/responses";
  process.env.IBAND_AI_API_KEY = "test-key";

  const providerTarget = describeCurrentMovieMentorProviderTarget();
  const providerOperation = Object.freeze({
    providerOperationId: "provider-call-capability-proof",
    executionId: "execution-capability-proof",
    slotId: "semantic",
    task: "movie-mentor-semantic",
    providerTarget,
  });

  process.env.IBAND_AI_MODEL = "drifted-model";
  let networkCalls = 0;
  let observedBody = null;
  globalThis.fetch = async (_url, options = {}) => {
    networkCalls += 1;
    observedBody = JSON.parse(options.body || "{}");
    return new Response(JSON.stringify({ id: "resp-capability-proof", model: "drifted-model", output_text: JSON.stringify({ value: "ok" }), usage: { total_tokens: 1 } }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await assert.rejects(
    () => executeStructuredAI({
      task: "movie-mentor-provider-capability-proof",
      systemInstructions: "Return the required schema.",
      input: { proof: true },
      schema,
      schemaName: "movie_mentor_provider_capability_authority",
      providerOperation,
    }),
    (error) => error?.code === "AI_PROVIDER_TRANSPORT_TARGET_AUTHORITY_INVALID",
    "the provider socket must reject model capability drift after provider-operation authority was earned",
  );
  assert.equal(networkCalls, 0, "model capability drift must fail before the irreversible provider socket");
  assert.equal(observedBody, null, "the drifted model must never receive the authorized operation");

  console.log("LAW: THE PROVIDER OPERATION MUST BIND THE EXACT EXECUTION CAPABILITY, NOT MERELY THE HOST THAT RECEIVES IT.");
  console.log("Movie Mentor provider capability authority: GREEN");
} finally {
  restore();
}
