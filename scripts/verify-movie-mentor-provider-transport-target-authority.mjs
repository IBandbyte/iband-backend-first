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

try {
  process.env.IBAND_AI_PROVIDER = "openai";
  process.env.IBAND_AI_MODEL = "gpt-test";
  process.env.IBAND_AI_BASE_URL = "https://authorized-provider.example.test/v1/responses";
  process.env.IBAND_AI_API_KEY = "test-key";

  const providerTarget = describeCurrentMovieMentorProviderTarget();
  const providerOperation = Object.freeze({
    providerOperationId: "provider-call-transport-target-proof",
    executionId: "execution-transport-target-proof",
    slotId: "semantic",
    task: "movie-mentor-semantic",
    providerTarget,
  });

  // Authority was earned while the exact durable target was route A.
  // Simulate configuration drift after the authority check but before the irreversible socket.
  process.env.IBAND_AI_BASE_URL = "https://drifted-provider.example.test/v1/responses";

  let networkCalls = 0;
  let observedUrl = null;
  globalThis.fetch = async (url) => {
    networkCalls += 1;
    observedUrl = String(url);
    return new Response(JSON.stringify({
      id: "resp-transport-target-proof",
      model: "gpt-test",
      output_text: JSON.stringify({ value: "ok" }),
      usage: { total_tokens: 1 },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await assert.rejects(
    () => executeStructuredAI({
      task: "movie-mentor-transport-target-proof",
      systemInstructions: "Return the required schema.",
      input: { proof: true },
      schema: { type: "object", additionalProperties: false, properties: { value: { type: "string" } }, required: ["value"] },
      schemaName: "movie_mentor_transport_target_authority",
      providerOperation,
    }),
    (error) => error?.code === "AI_PROVIDER_TRANSPORT_TARGET_AUTHORITY_INVALID",
    "the provider socket must reject configuration drift after provider-target authority was earned",
  );

  assert.equal(networkCalls, 0, "target drift must fail before the irreversible provider socket");
  assert.equal(observedUrl, null, "no drifted destination may receive the request");

  console.log("LAW: THE TARGET THAT CROSSES THE NETWORK BOUNDARY MUST BE THE TARGET THAT WON AUTHORITY.");
  console.log("LAW: A PRE-FLIGHT TARGET CHECK IS NOT A TRANSPORT BINDING.");
  console.log("Movie Mentor provider transport-target authority: GREEN");
} finally {
  restore();
}
