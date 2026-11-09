import assert from "node:assert/strict";
import { createMovieMentorCreatorStateRecoveryProductionComposition } from "../ai/MovieMentorCreatorStateRecoveryProductionComposition.js";

// VERIFIER FIRST: production wiring must require pinned-key authentication,
// durable ownership and authoritative creator-state read. No real DB writes.
const events = [];
const composition = createMovieMentorCreatorStateRecoveryProductionComposition({
  authentication: {
    ready: true, provider: "clerk", verifierAlgorithm: "RS256",
    verifierNetworkMode: "pinned-public-key", expectedIssuer: "https://issuer.example",
    expectedAudience: "movie-mentor",
    async verifyCredential({ credential }) {
      events.push("jwt");
      if (credential !== "signed") throw new Error("invalid signature");
      return { verified: true, subject: "owner-a", active: true, revoked: false };
    },
  },
  ownershipAuthority: {
    async authorizeProject({ principal, projectId }) {
      events.push("ownership");
      return { authorized: principal.principalId === "owner-a", projectId, ownershipRef: "durable-owner", ownershipRevision: 1 };
    },
  },
  readCreatorState: async ({ projectId }) => {
    events.push("mongo-read");
    return { projectId, revision: 1, creatorStateGeneration: 1 };
  },
});
const rejected = await composition.handle({ method: "GET", headers: { authorization: "Bearer forged" }, params: { projectId: "project-a" } });
assert.notEqual(rejected.status, 200);
assert.deepEqual(events, ["jwt"], "RED: invalid JWT must never reach ownership or Mongo");
events.length = 0;
const accepted = await composition.handle({ method: "GET", headers: { authorization: "Bearer signed" }, params: { projectId: "project-a" } });
assert.equal(accepted.status, 200);
assert.equal(accepted.body.state.projectId, "project-a");
assert.deepEqual(events, ["jwt", "ownership", "mongo-read", "ownership"]);
console.log("GREEN: composed signed-credential, durable owner and creator-state read contract; invalid signature denied.");
console.log("LIMITATION: injected doubles; physical Clerk RS256, Express and Mongo not certified.");
