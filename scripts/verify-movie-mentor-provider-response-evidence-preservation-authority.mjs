import assert from "node:assert/strict";
import { executeStructuredAI } from "../ai/StructuredAIProviderClient.js";
import { interpretMovieMentorSemantics } from "../ai/MovieMentorSemanticInterpreter.js";

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

function providerResponse({ id, outputText }) {
  return new Response(JSON.stringify({ id, model: "gpt-test", output_text: outputText, usage: { total_tokens: 1 } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function captureFailure(run) {
  try {
    await run();
  } catch (error) {
    return error;
  }
  assert.fail("expected a post-provider local validation failure");
}

try {
  installOpenAIEnvironment();

  let networkCalls = 0;
  globalThis.fetch = async () => {
    networkCalls += 1;
    return providerResponse({ id: "resp-structured-known", outputText: "{}" });
  };

  const structuredError = await captureFailure(() => executeStructuredAI({
    task: "movie-mentor-proof",
    systemInstructions: "Return the exact requested schema.",
    input: { proof: true },
    schema: {
      type: "object",
      additionalProperties: false,
      properties: { requiredValue: { type: "string" } },
      required: ["requiredValue"],
    },
    schemaName: "movie_mentor_provider_response_evidence_proof",
  }));

  assert.equal(networkCalls, 1, "the verifier must prove a real successful provider response occurred before local rejection");
  assert.equal(structuredError?.code, "AI_PROVIDER_STRUCTURED_OUTPUT_SCHEMA_INVALID", "shared provider client must fail for local schema reasons after provider success");
  assert.deepEqual(
    structuredError?.providerEffectEvidence,
    { externalEffectId: "resp-structured-known", provider: "openai" },
    "a known provider response ID must survive shared-client local validation failure so runtime can durably resolve UNKNOWN reality",
  );

  globalThis.fetch = async () => {
    networkCalls += 1;
    return providerResponse({ id: "resp-semantic-known", outputText: "not-json" });
  };

  const semanticError = await captureFailure(() => interpretMovieMentorSemantics({
    message: "A lighthouse sends messages from a missing daughter.",
    context: { creatorConfirmedContext: [] },
  }));

  assert.equal(networkCalls, 2, "semantic proof must cross its independent live provider socket exactly once");
  assert.equal(semanticError?.code, "SEMANTIC_STRUCTURED_OUTPUT_INVALID", "semantic interpreter must fail only after receiving the provider response ID");
  assert.deepEqual(
    semanticError?.providerEffectEvidence,
    { externalEffectId: "resp-semantic-known", provider: "openai" },
    "a known provider response ID must survive semantic post-provider parsing failure so runtime can durably resolve UNKNOWN reality",
  );

  console.log("✓ shared structured provider client preserves known provider effect identity across local validation failure");
  console.log("✓ semantic provider socket preserves known provider effect identity across post-response parsing failure");
  console.log("LAW: POST-PROVIDER VALIDATION FAILURE MAY REVOKE RESULT AUTHORITY. IT MAY NOT ERASE PROVIDER-EFFECT EVIDENCE.");
  console.log("LAW: THE FIRST TRUSTWORTHY PROVIDER ID MUST SURVIVE UNTIL THE DURABLE EFFECT LEDGER CAN RECORD IT.");
  console.log("Movie Mentor provider response evidence preservation authority gate: GREEN");
} finally {
  restoreEnvironment();
}
