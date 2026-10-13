import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { interpretMovieMentorSemantics } from "../ai/MovieMentorSemanticInterpreter.js";

// WARP 84: physical loopback-only observation. No production network or credentials.
const keys = ["IBAND_AI_PROVIDER", "IBAND_AI_BASE_URL", "IBAND_AI_API_KEY", "IBAND_AI_TIMEOUT_MS"];
const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const requests = [];
const destination = createServer(async (request, response) => {
  let body = "";
  for await (const chunk of request) body += chunk.toString();
  requests.push({ method: request.method, headers: request.headers, body });
  response.writeHead(422, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ error: { message: "intentional local destination rejection" } }));
});
const origin = createServer((request, response) => {
  response.writeHead(307, { Location: `http://127.0.0.1:${destination.address().port}/redirect-target` });
  response.end();
});
try {
  destination.listen(0, "127.0.0.1");
  await once(destination, "listening");
  origin.listen(0, "127.0.0.1");
  await once(origin, "listening");
  process.env.IBAND_AI_PROVIDER = "generic-http";
  process.env.IBAND_AI_BASE_URL = `http://127.0.0.1:${origin.address().port}/configured-provider`;
  process.env.IBAND_AI_API_KEY = "warp84-disposable-local-token";
  process.env.IBAND_AI_TIMEOUT_MS = "3000";
  let failed = false;
  try {
    await interpretMovieMentorSemantics({ message: "A fictional scene begins." }, {
      providerOperation: { providerOperationId: "warp84-operation", executionId: "warp84-execution", slotId: "semantic", task: "movie-mentor-semantic" },
    });
  } catch {
    failed = true;
  }
  assert.equal(failed, true, "local destination intentionally rejects the request");
  assert.equal(requests.length, 1, "Node fetch followed the 307 redirect to the unconfigured local destination");
  assert.equal(requests[0].method, "POST", "307 preserves the semantic POST");
  const body = JSON.parse(requests[0].body);
  assert.equal(body.task, "movie-mentor-semantic-interpretation");
  assert.equal(typeof body.input, "object");
  assert.equal(requests[0].headers.authorization, undefined, "cross-origin fetch must strip Authorization");
  console.log("WARP84 OBSERVATION: redirected semantic POST body reached a different loopback origin; Authorization was stripped. This is not a production defect verdict.");
} finally {
  for (const key of keys) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
  await Promise.all([origin, destination].map((server) => new Promise((resolve) => server.close(resolve))));
}
