import assert from "node:assert/strict";
import { createMovieMentorCreatorStateRecoveryHttpHandler } from "../ai/MovieMentorCreatorStateRecoveryHttpHandler.js";

// VERIFIER FIRST. An HTTP GET recovery boundary must use server-verifiable
// credentials and durable owner checks, not user-supplied identity claims.
const calls = [];
const handler = createMovieMentorCreatorStateRecoveryHttpHandler({
  authenticate: async ({ authorization }) => {
    calls.push("authenticate");
    return authorization === "Bearer valid"
      ? { authenticated: true, principalId: "owner-a" }
      : { authenticated: false };
  },
  readAuthority: {
    async read({ principal, projectId }) {
      calls.push("read-authority");
      return principal?.principalId === "owner-a" && projectId === "project-a"
        ? { authorized: true, state: { projectId, revision: 2, creatorStateGeneration: 3 } }
        : { authorized: false };
    },
  },
});
const denied = await handler({ method: "GET", headers: { authorization: "Bearer invalid" }, params: { projectId: "project-a" } });
assert.notEqual(denied.status, 200);
assert.deepEqual(calls, ["authenticate"], "RED: unverified credentials must never reach owner-bound state authority");
calls.length = 0;
const accepted = await handler({ method: "GET", headers: { authorization: "Bearer valid" }, params: { projectId: "project-a" } });
assert.equal(accepted.status, 200);
assert.equal(accepted.body.success, true);
assert.equal(accepted.body.state.projectId, "project-a");
assert.equal(accepted.body.state.revision, 2);
assert.deepEqual(calls, ["authenticate", "read-authority"]);
calls.length = 0;
const wrongMethod = await handler({ method: "POST", headers: { authorization: "Bearer valid" }, params: { projectId: "project-a" } });
assert.notEqual(wrongMethod.status, 200);
assert.deepEqual(calls, [], "RED: write-like methods must never enter read-only recovery");
console.log("GREEN: isolated GET recovery requires verified principal, owner-bound read and frontend-compatible state response.");
console.log("LIMITATION: injected mocks; real Clerk RS256, Express mount, durable Mongo and production ingress not certified.");
