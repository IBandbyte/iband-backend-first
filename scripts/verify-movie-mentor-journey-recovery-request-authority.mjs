import assert from "node:assert/strict";
import { createMovieMentorJourneyRecoveryRequestAuthority } from "../ai/MovieMentorJourneyRecoveryRequestAuthority.js";

const NOW = new Date("2026-08-28T20:00:00.000Z");
const ISSUER = "https://auth.example.test";
const AUDIENCE = "movie-mentor";
const PROJECT = "movie-project-owner";

function request(token = "owner-token", body = {}) {
  return { headers: { authorization: `Bearer ${token}` }, body };
}

function evidence(subject = "principal-owner", overrides = {}) {
  return {
    verified: true,
    subject,
    issuer: ISSUER,
    audience: AUDIENCE,
    sessionReference: `session:${subject}`,
    authenticatedAt: "2026-08-28T19:00:00.000Z",
    expiresAt: "2026-08-28T21:00:00.000Z",
    verificationMethod: "external-test-verifier",
    verificationVersion: "1",
    active: true,
    ...overrides,
  };
}

function ownershipAuthority({ owner = "principal-owner", malformed = false, conflictingProject = false } = {}) {
  return {
    authorizeProject: async ({ principal, projectId }) => {
      if (malformed) throw Object.assign(new Error("Malformed durable ownership"), { code: "MOVIE_MENTOR_PROJECT_OWNERSHIP_RECORD_INVALID" });
      if (principal.principalId !== owner) return Object.freeze({ authorized: false, projectId, reason: "principal-not-owner" });
      return Object.freeze({
        authorized: true,
        projectId: conflictingProject ? "movie-project-other" : projectId,
        ownershipRef: `ownership:${projectId}`,
        authorizationSource: "movie-mentor-project-ownership-registry",
      });
    },
  };
}

function make({ verifyCredential, ownership = ownershipAuthority(), expectedIssuer = ISSUER, expectedAudience = AUDIENCE } = {}) {
  return createMovieMentorJourneyRecoveryRequestAuthority({
    verifyCredential,
    ownershipAuthority: ownership,
    expectedIssuer,
    expectedAudience,
    now: () => NOW,
  });
}

async function expectCode(code, fn) {
  let thrown = null;
  try { await fn(); } catch (error) { thrown = error; }
  assert.ok(thrown, `Expected ${code} to throw.`);
  assert.equal(thrown.code, code);
}

const ownerVerifier = async ({ credential }) => {
  assert.equal(credential, "owner-token");
  return evidence();
};

// Baseline: only verified external identity plus durable ownership authorizes recovery.
{
  const authority = make({ verifyCredential: ownerVerifier });
  const result = await authority.authorize({ request: request("owner-token"), projectId: PROJECT });
  assert.equal(result.authorized, true);
  assert.equal(result.principalId, "principal-owner");
  assert.equal(result.projectId, PROJECT);
  assert.equal(result.ownershipRef, `ownership:${PROJECT}`);
  assert.equal(result.authenticationSource, "deterministic-credential-verifier");
  assert.equal(result.authorizationSource, "movie-mentor-project-ownership-registry");
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.principal));
}

// Body claims cannot upgrade attacker credentials into owner authority.
{
  const authority = make({
    verifyCredential: async ({ credential }) => {
      assert.equal(credential, "attacker-token");
      return evidence("principal-attacker");
    },
  });
  await expectCode("MOVIE_MENTOR_JOURNEY_RECOVERY_NOT_AUTHORIZED", () => authority.authorize({
    request: request("attacker-token", { principalId: "principal-owner", userId: "principal-owner", ownerId: "principal-owner", projectId: PROJECT, admin: true }),
    projectId: PROJECT,
  }));
}

// Even a body-only identity with no Bearer credential has zero authority.
{
  const authority = make({ verifyCredential: async () => evidence() });
  await expectCode("MOVIE_MENTOR_AUTH_CREDENTIAL_REQUIRED", () => authority.authorize({
    request: { body: { principalId: "principal-owner", ownerId: "principal-owner", admin: true } },
    projectId: PROJECT,
  }));
}

// External verification is mandatory; this layer does not invent a token/JWT verifier.
{
  const authority = make({ verifyCredential: null });
  await expectCode("MOVIE_MENTOR_AUTH_VERIFIER_REQUIRED", () => authority.authorize({ request: request(), projectId: PROJECT }));
}

for (const [code, overrides] of [
  ["MOVIE_MENTOR_AUTH_NOT_VERIFIED", { verified: false }],
  ["MOVIE_MENTOR_AUTH_EXPIRED", { expiresAt: "2026-08-28T19:59:59.000Z" }],
  ["MOVIE_MENTOR_AUTH_REVOKED", { revoked: true }],
]) {
  const authority = make({ verifyCredential: async () => evidence("principal-owner", overrides) });
  await expectCode(code, () => authority.authorize({ request: request(), projectId: PROJECT }));
}

{
  const authority = make({ verifyCredential: async () => evidence("principal-owner", { issuer: "https://evil.example.test" }) });
  await expectCode("MOVIE_MENTOR_AUTH_ISSUER_MISMATCH", () => authority.authorize({ request: request(), projectId: PROJECT }));
}

{
  const authority = make({ verifyCredential: async () => evidence("principal-owner", { audience: "other-service" }) });
  await expectCode("MOVIE_MENTOR_AUTH_AUDIENCE_MISMATCH", () => authority.authorize({ request: request(), projectId: PROJECT }));
}

// A valid owner credential grants no authority over another owner's project.
{
  const authority = make({ verifyCredential: ownerVerifier, ownership: ownershipAuthority({ owner: "principal-other" }) });
  await expectCode("MOVIE_MENTOR_JOURNEY_RECOVERY_NOT_AUTHORIZED", () => authority.authorize({ request: request(), projectId: PROJECT }));
}

// Missing/unestablished ownership is fail closed.
{
  const authority = make({
    verifyCredential: ownerVerifier,
    ownership: { authorizeProject: async ({ projectId }) => ({ authorized: false, projectId, reason: "ownership-not-established" }) },
  });
  await expectCode("MOVIE_MENTOR_JOURNEY_RECOVERY_NOT_AUTHORIZED", () => authority.authorize({ request: request(), projectId: PROJECT }));
}

// Malformed durable ownership is not converted into denial-shaped success.
{
  const authority = make({ verifyCredential: ownerVerifier, ownership: ownershipAuthority({ malformed: true }) });
  await expectCode("MOVIE_MENTOR_PROJECT_OWNERSHIP_RECORD_INVALID", () => authority.authorize({ request: request(), projectId: PROJECT }));
}

// Resolver may not authorize one project while returning another project identity.
{
  const authority = make({ verifyCredential: ownerVerifier, ownership: ownershipAuthority({ conflictingProject: true }) });
  await expectCode("MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHORIZATION_PROJECT_CONFLICT", () => authority.authorize({ request: request(), projectId: PROJECT }));
}

// Project identity must be supplied outside request body; body projectId is never selected implicitly.
{
  const authority = make({ verifyCredential: ownerVerifier });
  await expectCode("MOVIE_MENTOR_JOURNEY_RECOVERY_PROJECT_REQUIRED", () => authority.authorize({ request: request("owner-token", { projectId: PROJECT }) }));
}

console.log("PASS Movie Mentor journey recovery request authority torture: external identity, durable ownership, body-claim quarantine, fail-closed project binding.");
