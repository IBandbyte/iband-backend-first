import assert from "node:assert/strict";
import {
  executeStructuredAI,
  transportTargetFromConfig,
} from "../ai/StructuredAIProviderClient.js";
import { retrieveMovieMentorProviderResponse } from "../ai/MovieMentorProviderRecoveryAdapter.js";

const originalFetch = globalThis.fetch;
const envKeys = [
  "IBAND_AI_PROVIDER",
  "IBAND_AI_MODEL",
  "IBAND_AI_BASE_URL",
  "IBAND_AI_API_KEY",
  "OPENAI_API_KEY",
];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

const authorizedUrl = "https://provider.example.test/v1/responses?tenant=authorized&mode=strict";
const driftedUrl = "https://provider.example.test/v1/responses?tenant=drifted&mode=strict";
const providerOperationId = "provider-call-query-target-authority";
const externalEffectId = "resp_query_target_authority";
const schema = {
  type: "object",
  additionalProperties: false,
  properties: { ok: { type: "boolean" } },
  required: ["ok"],
};

const authorizedTarget = Object.freeze({
  ...transportTargetFromConfig({
    provider: "openai",
    model: "gpt-test",
    url: authorizedUrl,
  }),
  dispatchModel: "gpt-test",
});

let networkCalls = 0;
let lastUrl = null;
const failures = [];

async function expectClosed(label, operation, expectedCode) {
  try {
    await assert.rejects(
      operation,
      (error) => {
        assert.equal(error?.code, expectedCode);
        assert.equal(error?.retryable, false);
        return true;
      },
      label,
    );
  } catch (error) {
    failures.push(`${label}: ${error?.message || error}`);
  }
}

try {
  process.env.IBAND_AI_PROVIDER = "openai";
  process.env.IBAND_AI_MODEL = "gpt-test";
  process.env.IBAND_AI_API_KEY = "test-key";
  delete process.env.OPENAI_API_KEY;

  globalThis.fetch = async (url, options = {}) => {
    networkCalls += 1;
    lastUrl = String(url);
    if (options.method === "GET") {
      return new Response(JSON.stringify({ id: externalEffectId, status: "completed", output_text: "{}" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({
      id: "resp_query_target_dispatch",
      model: "gpt-test",
      output_text: JSON.stringify({ ok: true }),
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  process.env.IBAND_AI_BASE_URL = driftedUrl;

  await expectClosed(
    "provider dispatch must fail closed when only the network query changes after target authority was earned",
    executeStructuredAI({
      task: "movie-mentor-query-target-authority",
      systemInstructions: "Return the required schema.",
      input: { probe: true },
      schema,
      schemaName: "movie_mentor_query_target_authority",
      providerOperation: {
        providerOperationId,
        executionId: "execution-query-target-authority",
        slotId: "semantic",
        task: "movie-mentor-query-target-authority",
        providerTarget: authorizedTarget,
        providerModelAuthorityBound: true,
        providerModel: "gpt-test",
      },
    }),
    "AI_PROVIDER_TRANSPORT_TARGET_AUTHORITY_INVALID",
  );

  await expectClosed(
    "provider recovery must fail closed when only the network query changes after historical target authority was earned",
    retrieveMovieMentorProviderResponse({
      method: "retrieve-known-response-id",
      providerCallId: providerOperationId,
      providerOperationId,
      executionId: "execution-query-target-authority",
      slotId: "semantic",
      task: "movie-mentor-query-target-authority",
      externalEffectId,
      providerTarget: authorizedTarget,
    }),
    "MOVIE_MENTOR_PROVIDER_RECOVERY_TRANSPORT_TARGET_AUTHORITY_INVALID",
  );

  process.env.IBAND_AI_BASE_URL = authorizedUrl;
  networkCalls = 0;
  lastUrl = null;

  await retrieveMovieMentorProviderResponse({
    method: "retrieve-known-response-id",
    providerCallId: providerOperationId,
    providerOperationId,
    executionId: "execution-query-target-authority",
    slotId: "semantic",
    task: "movie-mentor-query-target-authority",
    externalEffectId,
    providerTarget: authorizedTarget,
  });

  try {
    assert.equal(networkCalls, 1, "authorized recovery should perform exactly one GET");
    const retrieval = new URL(lastUrl);
    assert.equal(retrieval.searchParams.get("tenant"), "authorized", "recovery GET must preserve the authorized route query");
    assert.equal(retrieval.searchParams.get("mode"), "strict", "recovery GET must preserve every authorized route query component");
  } catch (error) {
    failures.push(`authorized recovery query preservation: ${error?.message || error}`);
  }

  assert.deepEqual(
    failures,
    [],
    `provider query-target authority violations:\n${failures.map((failure) => `- ${failure}`).join("\n")}`,
  );
} finally {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
}

console.log("✓ provider target authority binds the network query and recovery preserves the authorized query");
console.log("LAW: IF A QUERY CROSSES THE NETWORK BOUNDARY, IT IS PART OF THE PROVIDER ROUTE THAT MUST WIN AUTHORITY.");
console.log("Movie Mentor provider query-target authority gate: GREEN");
