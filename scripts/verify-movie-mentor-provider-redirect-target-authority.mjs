import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import {
  executeStructuredAI,
  transportTargetFromConfig,
} from "../ai/StructuredAIProviderClient.js";
import { retrieveMovieMentorProviderResponse } from "../ai/MovieMentorProviderRecoveryAdapter.js";

const envKeys = [
  "IBAND_AI_PROVIDER",
  "IBAND_AI_MODEL",
  "IBAND_AI_BASE_URL",
  "IBAND_AI_API_KEY",
  "OPENAI_API_KEY",
];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function close(server) {
  if (!server.listening) return;
  server.close();
  await once(server, "close");
}

let redirectedPostCalls = 0;
let redirectedRecoveryCalls = 0;

const externalEffectId = "resp_redirect_target_authority";
const providerOperationId = "provider-call-redirect-target-authority";
const schema = {
  type: "object",
  additionalProperties: false,
  properties: { ok: { type: "boolean" } },
  required: ["ok"],
};

const redirectTarget = http.createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (request.method === "POST") {
    redirectedPostCalls += 1;
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      id: "resp_redirected_post",
      model: "gpt-test",
      output_text: JSON.stringify({ ok: true }),
    }));
    return;
  }
  if (request.method === "GET") {
    redirectedRecoveryCalls += 1;
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ id: externalEffectId, status: "completed", output_text: "{}" }));
    return;
  }
  response.writeHead(405).end();
});

const authorizedOrigin = http.createServer((request, response) => {
  response.writeHead(307, { Location: `${redirectTarget.baseUrl}${request.url}` });
  response.end();
});

try {
  redirectTarget.baseUrl = await listen(redirectTarget);
  const authorizedBase = await listen(authorizedOrigin);
  const authorizedUrl = `${authorizedBase}/v1/responses`;

  process.env.IBAND_AI_PROVIDER = "openai";
  process.env.IBAND_AI_MODEL = "gpt-test";
  process.env.IBAND_AI_BASE_URL = authorizedUrl;
  process.env.IBAND_AI_API_KEY = "test-key";
  delete process.env.OPENAI_API_KEY;

  const providerTarget = transportTargetFromConfig({
    provider: "openai",
    model: "gpt-test",
    url: authorizedUrl,
  });

  await assert.rejects(
    executeStructuredAI({
      task: "movie-mentor-redirect-target-authority",
      systemInstructions: "Return the required schema.",
      input: { probe: true },
      schema,
      schemaName: "movie_mentor_redirect_target_authority",
      providerOperation: {
        providerOperationId,
        executionId: "execution-redirect-target-authority",
        slotId: "semantic",
        task: "movie-mentor-redirect-target-authority",
        providerTarget,
        providerModel: "gpt-test",
      },
    }),
    (error) => {
      assert.equal(error?.code, "AI_PROVIDER_REDIRECT_FORBIDDEN");
      assert.equal(error?.retryable, false);
      return true;
    },
    "provider POST must fail closed rather than follow a redirect away from the exact authorized provider route",
  );

  await assert.rejects(
    retrieveMovieMentorProviderResponse({
      method: "retrieve-known-response-id",
      providerCallId: providerOperationId,
      providerOperationId,
      executionId: "execution-redirect-target-authority",
      slotId: "semantic",
      task: "movie-mentor-redirect-target-authority",
      externalEffectId,
      providerTarget,
    }),
    (error) => {
      assert.equal(error?.code, "MOVIE_MENTOR_PROVIDER_RECOVERY_REDIRECT_FORBIDDEN");
      assert.equal(error?.retryable, false);
      return true;
    },
    "provider recovery GET must fail closed rather than follow a redirect away from the exact authorized historical route",
  );

  assert.equal(redirectedPostCalls, 0, "no redirected POST may reach a second network target");
  assert.equal(redirectedRecoveryCalls, 0, "no redirected recovery GET may reach a second network target");
} finally {
  await close(authorizedOrigin);
  await close(redirectTarget);
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
}

console.log("✓ provider POST and recovery GET reject redirects before a second target receives authority-bearing traffic");
console.log("LAW: AN AUTHORIZED PROVIDER ROUTE MAY NOT DELEGATE THE NETWORK BOUNDARY THROUGH AN AUTOMATIC REDIRECT.");
console.log("Movie Mentor provider redirect target authority gate: GREEN");
