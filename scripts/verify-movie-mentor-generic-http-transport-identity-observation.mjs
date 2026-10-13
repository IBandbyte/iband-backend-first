import assert from "node:assert/strict";
import { executeStructuredAI } from "../ai/StructuredAIProviderClient.js";
import { describeCurrentMovieMentorProviderTarget } from "../ai/MovieMentorProviderTargetAuthority.js";

const originalFetch = globalThis.fetch;
const keys = ["IBAND_AI_PROVIDER", "IBAND_AI_MODEL", "IBAND_AI_BASE_URL", "IBAND_AI_API_KEY"];
const originalEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const schema = { type: "object", additionalProperties: false, properties: { value: { type: "string" } }, required: ["value"] };
try {
  process.env.IBAND_AI_PROVIDER = "generic-http";
  process.env.IBAND_AI_MODEL = "generic-test";
  process.env.IBAND_AI_BASE_URL = "https://generic-provider.example.test/execute";
  process.env.IBAND_AI_API_KEY = "test-key";
  const providerTarget = describeCurrentMovieMentorProviderTarget();
  assert.equal(providerTarget.recoveryMode, "none");
  const providerOperation = Object.freeze({
    providerOperationId: "generic-operation-identity-1",
    executionId: "generic-execution-identity-1",
    slotId: "semantic",
    task: "movie-mentor-semantic",
    providerTarget,
  });
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), headers: { ...options.headers }, body: JSON.parse(options.body) });
    return new Response(JSON.stringify({ structured: { value: "ok" }, id: "generic-effect-1" }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const result = await executeStructuredAI({
    task: "movie-mentor-semantic",
    systemInstructions: "Return the required schema.",
    input: { example: true },
    schema,
    schemaName: "generic_transport_identity_probe",
    providerOperation,
  });
  assert.equal(result.structured.value, "ok");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, process.env.IBAND_AI_BASE_URL);
  assert.equal(requests[0].headers["Idempotency-Key"], undefined);
  assert.equal(requests[0].body.providerOperationId, undefined);
  assert.equal(requests[0].body.providerOperation, undefined);
  assert.equal(result.metadata.provider, "generic-http");
  console.log("OBSERVED: generic-http structured AI transport omits durable operation identity at outbound request boundary.");
  console.log("VERIFIER: source-level transport observation reproduced at executable mocked socket; not yet a production defect verdict.");
} finally {
  globalThis.fetch = originalFetch;
  for (const key of keys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
}
