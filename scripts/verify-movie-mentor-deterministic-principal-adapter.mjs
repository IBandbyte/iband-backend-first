import assert from "node:assert/strict";
import {
  deriveMovieMentorPrincipal,
  validateVerifiedEvidence,
} from "../ai/MovieMentorDeterministicPrincipalAdapter.js";

const NOW = new Date("2026-08-27T21:20:00.000Z");
const ISSUER = "https://auth.example.test";
const AUDIENCE = "movie-mentor";

function request(token = "valid-token", body = {}) {
  return {
    headers: { authorization: `Bearer ${token}` },
    body,
  };
}

function evidence(overrides = {}) {
  return {
    verified: true,
    subject: "principal-owner",
    issuer: ISSUER,
    audience: AUDIENCE,
    sessionReference: "session-1",
    authenticatedAt: "2026-08-27T20:00:00.000Z",
    expiresAt: "2026-08-27T22:00:00.000Z",
    verificationMethod: "test-signature-verifier",
    verificationVersion: "1",
    active: true,
    ...overrides,
  };
}

async function expectCode(code, fn) {
  let thrown = null;
  try {
    await fn();
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown, `Expected ${code} to throw.`);
  assert.equal(thrown.code, code);
}

await expectCode("MOVIE_MENTOR_AUTH_CREDENTIAL_REQUIRED", () =>
  deriveMovieMentorPrincipal({ request: { body: { principalId: "principal-owner" } }, verifyCredential: async () => evidence(), now: NOW })
);

await expectCode("MOVIE_MENTOR_AUTH_BEARER_REQUIRED", () =>
  deriveMovieMentorPrincipal({ request: { headers: { authorization: "Basic abc" } }, verifyCredential: async () => evidence(), now: NOW })
);

await expectCode("MOVIE_MENTOR_AUTH_VERIFIER_REQUIRED", () =>
  deriveMovieMentorPrincipal({ request: request(), now: NOW })
);

await expectCode("MOVIE_MENTOR_AUTH_NOT_VERIFIED", () =>
  deriveMovieMentorPrincipal({ request: request(), verifyCredential: async () => evidence({ verified: false }), now: NOW })
);

await expectCode("MOVIE_MENTOR_AUTH_ISSUER_MISMATCH", () =>
  deriveMovieMentorPrincipal({
    request: request(),
    verifyCredential: async () => evidence({ issuer: "https://evil.example.test" }),
    expectedIssuer: ISSUER,
    expectedAudience: AUDIENCE,
    now: NOW,
  })
);

await expectCode("MOVIE_MENTOR_AUTH_AUDIENCE_MISMATCH", () =>
  deriveMovieMentorPrincipal({
    request: request(),
    verifyCredential: async () => evidence({ audience: "some-other-service" }),
    expectedIssuer: ISSUER,
    expectedAudience: AUDIENCE,
    now: NOW,
  })
);

await expectCode("MOVIE_MENTOR_AUTH_EXPIRED", () =>
  deriveMovieMentorPrincipal({ request: request(), verifyCredential: async () => evidence({ expiresAt: "2026-08-27T21:00:00.000Z" }), now: NOW })
);

await expectCode("MOVIE_MENTOR_AUTH_REVOKED", () =>
  deriveMovieMentorPrincipal({ request: request(), verifyCredential: async () => evidence({ revoked: true }), now: NOW })
);

await expectCode("MOVIE_MENTOR_AUTH_TIME_IN_FUTURE", () =>
  deriveMovieMentorPrincipal({ request: request(), verifyCredential: async () => evidence({ authenticatedAt: "2026-08-27T21:30:00.000Z" }), now: NOW })
);

await expectCode("MOVIE_MENTOR_AUTH_CLOCK_INVALID", () =>
  deriveMovieMentorPrincipal({ request: request(), verifyCredential: async () => evidence(), now: null })
);

await expectCode("MOVIE_MENTOR_AUTH_SUBJECT_REQUIRED", async () => {
  validateVerifiedEvidence(evidence({ subject: "" }), { now: NOW });
});

await expectCode("MOVIE_MENTOR_AUTH_ISSUER_REQUIRED", async () => {
  validateVerifiedEvidence(evidence({ issuer: "" }), { now: NOW });
});

await expectCode("MOVIE_MENTOR_AUTH_AUDIENCE_REQUIRED", async () => {
  validateVerifiedEvidence(evidence({ audience: "" }), { now: NOW });
});

const attacker = await deriveMovieMentorPrincipal({
  request: request("attacker-token", { principalId: "principal-owner", userId: "principal-owner" }),
  verifyCredential: async ({ credential }) => {
    assert.equal(credential, "attacker-token");
    return evidence({ subject: "principal-attacker", sessionReference: "attacker-session" });
  },
  expectedIssuer: ISSUER,
  expectedAudience: AUDIENCE,
  now: NOW,
});
assert.equal(attacker.principalId, "principal-attacker");
assert.equal(attacker.subject, "principal-attacker");
assert.equal(attacker.authenticated, true);
assert.equal(attacker.sessionReference, "attacker-session");
assert.ok(Object.isFrozen(attacker));

const owner = await deriveMovieMentorPrincipal({
  request: request("owner-token", { principalId: "principal-attacker" }),
  verifyCredential: async ({ credential, expectedIssuer, expectedAudience }) => {
    assert.equal(credential, "owner-token");
    assert.equal(expectedIssuer, ISSUER);
    assert.equal(expectedAudience, AUDIENCE);
    return evidence();
  },
  expectedIssuer: ISSUER,
  expectedAudience: AUDIENCE,
  now: NOW,
});
assert.deepEqual(
  {
    principalId: owner.principalId,
    authenticated: owner.authenticated,
    issuer: owner.issuer,
    audience: owner.audience,
    authenticationSource: owner.authenticationSource,
  },
  {
    principalId: "principal-owner",
    authenticated: true,
    issuer: ISSUER,
    audience: AUDIENCE,
    authenticationSource: "deterministic-credential-verifier",
  }
);

console.log("✓ absent authentication evaluation time cannot coerce to the Unix epoch");
console.log("PASS Movie Mentor deterministic principal adapter torture");
