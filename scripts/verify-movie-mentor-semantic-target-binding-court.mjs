import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { interpretMovieMentorSemantics } from "../ai/MovieMentorSemanticInterpreter.js";
import { describeCurrentMovieMentorProviderTarget } from "../ai/MovieMentorProviderTargetAuthority.js";

const keys = ["IBAND_AI_PROVIDER", "IBAND_AI_MODEL", "IBAND_AI_BASE_URL", "IBAND_AI_API_KEY", "OPENAI_API_KEY"];
const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
let authorizedCalls = 0;
let driftedCalls = 0;

function serverFor(which) {
  return http.createServer(async (request, response) => {
    for await (const _chunk of request) { /* Drain request to exercise actual HTTP transport. */ }
    if (which === "authorized") authorizedCalls++;
    else driftedCalls++;
    response.writeHead(503, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: { message: "isolated verifier endpoint" } }));
  });
}
async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return `http://127.0.0.1:${server.address().port}/semantic`;
}
async function close(server) {
  if (!server.listening) return;
  server.close();
  await once(server, "close");
}

const authorized = serverFor("authorized");
const drifted = serverFor("drifted");
try {
  const urlA = await listen(authorized);
  const urlB = await listen(drifted);
  process.env.IBAND_AI_PROVIDER = "generic-http";
  process.env.IBAND_AI_BASE_URL = urlA;
  delete process.env.IBAND_AI_API_KEY;
  const providerTarget = describeCurrentMovieMentorProviderTarget();
  const providerOperation = Object.freeze({
    providerOperationId: "semantic-target-binding-court-call",
    executionId: "semantic-target-binding-court-execution",
    slotId: "semantic",
    task: "movie-mentor-semantic",
    providerTarget,
  });

  // The operation was authorised for A. Drift the live configuration to B.
  process.env.IBAND_AI_BASE_URL = urlB;
  let error = null;
  try {
    await interpretMovieMentorSemantics(
      { message: "A retired astronaut discovers a mysterious lighthouse." },
      { providerOperation },
    );
  } catch (caught) {
    error = caught;
  }
  assert.equal(error?.code, "SEMANTIC_PROVIDER_TRANSPORT_TARGET_AUTHORITY_INVALID", "target drift must fail with the exact semantic transport authority error");
  assert.equal(driftedCalls, 0, "UNAUTHORISED: semantic POST reached provider B despite durable target A");
  assert.equal(authorizedCalls, 0, "a mismatched target must not silently dispatch to A");
  console.log("Semantic interpreter target-binding court: GREEN");
} finally {
  await close(authorized);
  await close(drifted);
  for (const key of keys) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
}
