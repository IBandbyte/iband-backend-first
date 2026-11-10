import { generateKeyPairSync, createSign } from "node:crypto";
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
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
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
function signedJwt(subject, signingKey = privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: "https://issuer.example", aud: "movie-mentor", azp: "http://127.0.0.1:7777",
    sub: subject, sid: "provenance-test-session", iat: now, nbf: now - 1, exp: now + 300,
  })).toString("base64url");
  const input = header + "." + payload;
  const signer = createSign("RSA-SHA256"); signer.update(input); signer.end();
  return input + "." + signer.sign(signingKey).toString("base64url");
}
const events = [];
const composition = createMovieMentorCreatorStateRecoveryProductionComposition({
  authentication: genuineAuthentication,
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
assert.deepEqual(events, [], "RED: invalid JWT must never reach ownership or Mongo");
events.length = 0;
const accepted = await composition.handle({ method: "GET", headers: { authorization: "Bearer " + signedJwt("owner-a") }, params: { projectId: "project-a" } });
assert.equal(accepted.status, 200);
assert.equal(accepted.body.state.projectId, "project-a");
assert.deepEqual(events, ["ownership", "mongo-read", "ownership"]);
console.log("GREEN: composed signed-credential, durable owner and creator-state read contract; invalid signature denied.");
console.log("LIMITATION: injected doubles; physical Clerk RS256, Express and Mongo not certified.");
