import assert from "node:assert/strict";
import { createMovieMentorProjectsRouter } from "../movieMentorProjects.js";

console.log("Movie Mentor native project creation HTTP ingress authority");

const PROJECT_ID = "movie-project-123e4567-e89b-42d3-a456-426614174000";
const IDENTITY = Object.freeze({
  domain: "iband.movie-mentor.project",
  schema: 1,
  issuance: "secure-web-crypto",
  legacy: false,
});

function routeHandler(router) {
  const layer = router.stack.find((entry) => entry.route?.path === "/projects");
  assert.ok(layer, "real Movie Mentor projects router must expose POST /projects");
  const handler = layer.route.stack?.[0]?.handle;
  assert.equal(typeof handler, "function", "POST /projects must have an executable Express handler");
  return handler;
}

async function invoke(handler, body) {
  let statusCode = 200;
  let responseBody = null;
  const req = { body };
  const res = {
    status(code) { statusCode = code; return this; },
    json(value) { responseBody = value; return value; },
  };
  await handler(req, res);
  return { statusCode, body: responseBody };
}

const forbiddenFields = [
  "principalId",
  "ownerPrincipalId",
  "authorityId",
  "verified",
  "type",
  "establishmentAuthority",
  "ownershipReference",
  "ownershipRevision",
];

for (const field of forbiddenFields) {
  let calls = 0;
  const authority = {
    async establishFromRequest() {
      calls += 1;
      throw new Error("forbidden client authority reached trusted native creation authority");
    },
  };
  const handler = routeHandler(createMovieMentorProjectsRouter({ nativeProjectCreationAuthority: authority }));
  const response = await invoke(handler, { projectId: PROJECT_ID, identity: IDENTITY, [field]: "client-controlled" });
  assert.equal(response.statusCode, 422, `${field} must be rejected at the HTTP boundary`);
  assert.equal(response.body?.success, false);
  assert.equal(response.body?.code, "MOVIE_MENTOR_NATIVE_PROJECT_CREATION_CLIENT_AUTHORITY_FORBIDDEN");
  assert.equal(calls, 0, `${field} must acquire zero trusted native creation authority`);
}

let legitimateCalls = 0;
let captured = null;
const authority = {
  async establishFromRequest(input) {
    legitimateCalls += 1;
    captured = input;
    return {
      status: "established",
      projectId: PROJECT_ID,
      identity: IDENTITY,
      ownership: {
        projectId: PROJECT_ID,
        ownershipRevision: 1,
        ownershipReference: "ownership:fixture",
        status: "active",
      },
    };
  },
};
const handler = routeHandler(createMovieMentorProjectsRouter({ nativeProjectCreationAuthority: authority }));
const legitimate = await invoke(handler, { projectId: PROJECT_ID, identity: IDENTITY });
assert.equal(legitimate.statusCode, 201);
assert.equal(legitimate.body?.success, true);
assert.equal(legitimateCalls, 1, "identity-only native creation must reach the trusted authority exactly once");
assert.equal(captured?.projectId, PROJECT_ID);
assert.deepEqual(captured?.identity, IDENTITY);
assert.equal(captured?.request?.body?.projectId, PROJECT_ID);
assert.equal(Object.hasOwn(captured?.request?.body || {}, "authorityId"), false);

console.log("PASS — real POST /projects handler rejects client-minted authority before trusted native creation and admits identity-only creation exactly once.");
