import { generateKeyPairSync } from "node:crypto";
import { createMovieMentorProductionAuthenticationComposition } from "../ai/MovieMentorProductionAuthenticationComposition.js";
import assert from "node:assert/strict";
import { createMovieMentorCreatorStateRecoveryProductionComposition } from "../ai/MovieMentorCreatorStateRecoveryProductionComposition.js";

// VERIFIER FIRST: metadata alone must never confer authentication ownership.
assert.throws(() => createMovieMentorCreatorStateRecoveryProductionComposition({
  authentication: {
    ready: true, provider: "clerk", verifierAlgorithm: "RS256",
    verifierNetworkMode: "pinned-public-key", expectedIssuer: "https://issuer.example",
    expectedAudience: "movie-mentor", async verifyCredential() { return { verified: true, subject: "forger", active: true, revoked: false }; },
  },
  ownershipAuthority: { async authorizeProject() { return { authorized: true }; } },
  readCreatorState: async () => ({ projectId: "project-a", revision: 1, creatorStateGeneration: 1 }),
}), /owner|provenance|authentication/i, "RED: self-asserted verifier must not authorize creator recovery");
const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const genuineAuthentication = createMovieMentorProductionAuthenticationComposition({
  env: {
    MOVIE_MENTOR_CLERK_JWT_KEY: publicKey.export({ type: "spki", format: "pem" }),
    MOVIE_MENTOR_CLERK_AUTHORIZED_PARTIES_JSON: JSON.stringify(["http://127.0.0.1:7777"]),
    MOVIE_MENTOR_CLERK_ISSUER: "https://issuer.example",
    MOVIE_MENTOR_AUDIENCE: "movie-mentor",
  },
});
assert.equal(genuineAuthentication.ready, true);
const proven = createMovieMentorCreatorStateRecoveryProductionComposition({
  authentication: genuineAuthentication,
  ownershipAuthority: { async authorizeProject() { return { authorized: false }; } },
  readCreatorState: async () => ({ projectId: "project-a", revision: 1, creatorStateGeneration: 1 }),
});
assert.equal(typeof proven.handle, "function");

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
