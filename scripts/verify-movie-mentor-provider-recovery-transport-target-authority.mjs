import assert from "node:assert/strict";
import { retrieveMovieMentorProviderResponse } from "../ai/MovieMentorProviderRecoveryAdapter.js";
import { fingerprintMovieMentorProviderRoute } from "../ai/MovieMentorProviderTargetAuthority.js";

const originalFetch = globalThis.fetch;
const envKeys = ["IBAND_AI_PROVIDER", "IBAND_AI_MODEL", "IBAND_AI_BASE_URL", "IBAND_AI_API_KEY", "OPENAI_API_KEY"];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

const authorizedUrl = "https://authorized-provider.example.test/v1/responses";
const driftedUrl = "https://drifted-provider.example.test/v1/responses";
const externalEffectId = "resp_recovery_transport_target_authority";
const providerOperationId = "provider-call-recovery-transport-target-authority";

const authorizedTarget = Object.freeze({
  provider: "openai",
  adapter: "openai-responses",
  routeFingerprint: fingerprintMovieMentorProviderRoute("openai", authorizedUrl),
  recoveryMode: "known-response-id-retrieval",
});

let networkCalls = 0;
try {
  process.env.IBAND_AI_PROVIDER = "openai";
  process.env.IBAND_AI_MODEL = "gpt-test";
  process.env.IBAND_AI_BASE_URL = driftedUrl;
  process.env.IBAND_AI_API_KEY = "test-key";

  globalThis.fetch = async () => {
    networkCalls += 1;
    return new Response(JSON.stringify({ id: externalEffectId, status: "completed", output_text: "{}" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  await assert.rejects(
    retrieveMovieMentorProviderResponse({
      method: "retrieve-known-response-id",
      providerCallId: providerOperationId,
      providerOperationId,
      executionId: "execution-recovery-transport-target-authority",
      slotId: "semantic",
      task: "movie-mentor-semantic",
      externalEffectId,
      providerTarget: authorizedTarget,
    }),
    (error) => {
      assert.equal(error?.code, "MOVIE_MENTOR_PROVIDER_RECOVERY_TRANSPORT_TARGET_AUTHORITY_INVALID");
      assert.equal(error?.retryable, false);
      return true;
    },
    "recovery transport must fail closed when current provider configuration no longer matches the durable historical provider target",
  );

  assert.equal(networkCalls, 0, "recovery target drift must be rejected before any network request crosses the socket boundary");
} finally {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
}

console.log("✓ recovery transport is bound to the exact durable provider target before network I/O");
console.log("LAW: RECOVERY MAY NOT CHOOSE A ROUTE THAT DID NOT WIN HISTORICAL PROVIDER-TARGET AUTHORITY.");
console.log("Movie Mentor provider recovery transport-target authority gate: GREEN");
