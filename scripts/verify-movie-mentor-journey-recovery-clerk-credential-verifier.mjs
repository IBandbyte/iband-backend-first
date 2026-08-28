import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createMovieMentorJourneyRecoveryClerkCredentialVerifier,
} from "../ai/MovieMentorJourneyRecoveryClerkCredentialVerifier.js";

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuZorgIsNotAuthority123
-----END PUBLIC KEY-----`;
const ISSUER = "https://movie-mentor.clerk.accounts.dev";
const AUDIENCE = "movie-mentor-recovery";
const AUTHORIZED_PARTIES = ["https://movie-mentor.example.com"];

function encode(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function fakeJwt(header = { alg: "RS256", typ: "JWT", kid: "key-1" }) {
  return `${encode(header)}.${encode({ sub: "untrusted-until-verified" })}.signature`;
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code);
}

async function expectAsyncCode(fn, code) {
  await assert.rejects(fn, (error) => error?.code === code);
}

console.log("[4H.2] trusted Clerk recovery credential verifier torture starting");

expectCode(
  () => createMovieMentorJourneyRecoveryClerkCredentialVerifier({ authorizedParties: AUTHORIZED_PARTIES }),
  "MOVIE_MENTOR_RECOVERY_CLERK_JWT_KEY_REQUIRED"
);
expectCode(
  () => createMovieMentorJourneyRecoveryClerkCredentialVerifier({
    jwtKey: "-----BEGIN PRIVATE KEY-----\nNOPE\n-----END PRIVATE KEY-----",
    authorizedParties: AUTHORIZED_PARTIES,
  }),
  "MOVIE_MENTOR_RECOVERY_CLERK_PRIVATE_KEY_FORBIDDEN"
);
expectCode(
  () => createMovieMentorJourneyRecoveryClerkCredentialVerifier({ jwtKey: PUBLIC_KEY }),
  "MOVIE_MENTOR_RECOVERY_CLERK_AUTHORIZED_PARTIES_REQUIRED"
);
for (const party of ["*", "all", "not-a-url", "ftp://example.com", "https://user:pass@example.com"]) {
  expectCode(
    () => createMovieMentorJourneyRecoveryClerkCredentialVerifier({
      jwtKey: PUBLIC_KEY,
      authorizedParties: [party],
    }),
    "MOVIE_MENTOR_RECOVERY_CLERK_AUTHORIZED_PARTY_INVALID"
  );
}

const calls = [];
const verifyTokenImpl = async (token, options) => {
  calls.push({ token, options });
  return {
    sub: "user_42",
    iss: ISSUER,
    aud: ["other-service", AUDIENCE],
    sid: "sess_42",
    iat: 1787938800,
    exp: 1787938860,
  };
};

const verifier = createMovieMentorJourneyRecoveryClerkCredentialVerifier({
  jwtKey: PUBLIC_KEY,
  authorizedParties: ["https://movie-mentor.example.com/", "https://movie-mentor.example.com"],
  verifyTokenImpl,
});
assert.equal(verifier.provider, "clerk");
assert.equal(verifier.algorithm, "RS256");
assert.equal(verifier.networkMode, "pinned-public-key");
assert.deepEqual(verifier.authorizedParties, AUTHORIZED_PARTIES);
assert.equal(Object.isFrozen(verifier), true);
assert.equal(Object.isFrozen(verifier.authorizedParties), true);

await expectAsyncCode(
  () => verifier.verifyCredential({ credential: "not-a-jwt", expectedIssuer: ISSUER, expectedAudience: AUDIENCE }),
  "MOVIE_MENTOR_RECOVERY_CLERK_JWT_MALFORMED"
);
await expectAsyncCode(
  () => verifier.verifyCredential({ credential: fakeJwt({ alg: "none", typ: "JWT" }), expectedIssuer: ISSUER, expectedAudience: AUDIENCE }),
  "MOVIE_MENTOR_RECOVERY_CLERK_JWT_ALGORITHM_FORBIDDEN"
);
await expectAsyncCode(
  () => verifier.verifyCredential({ credential: fakeJwt({ alg: "HS256", typ: "JWT" }), expectedIssuer: ISSUER, expectedAudience: AUDIENCE }),
  "MOVIE_MENTOR_RECOVERY_CLERK_JWT_ALGORITHM_FORBIDDEN"
);
await expectAsyncCode(
  () => verifier.verifyCredential({ credential: fakeJwt({ alg: "RS256", typ: "JWS" }), expectedIssuer: ISSUER, expectedAudience: AUDIENCE }),
  "MOVIE_MENTOR_RECOVERY_CLERK_JWT_TYPE_FORBIDDEN"
);
await expectAsyncCode(
  () => verifier.verifyCredential({ credential: fakeJwt(), expectedAudience: AUDIENCE }),
  "MOVIE_MENTOR_RECOVERY_CLERK_EXPECTED_ISSUER_REQUIRED"
);
await expectAsyncCode(
  () => verifier.verifyCredential({ credential: fakeJwt(), expectedIssuer: ISSUER }),
  "MOVIE_MENTOR_RECOVERY_CLERK_EXPECTED_AUDIENCE_REQUIRED"
);
await expectAsyncCode(
  () => verifier.verifyCredential({ credential: fakeJwt(), expectedIssuer: "*", expectedAudience: AUDIENCE }),
  "MOVIE_MENTOR_RECOVERY_CLERK_EXPECTED_ISSUER_REQUIRED"
);
await expectAsyncCode(
  () => verifier.verifyCredential({ credential: fakeJwt(), expectedIssuer: ISSUER, expectedAudience: "any" }),
  "MOVIE_MENTOR_RECOVERY_CLERK_EXPECTED_AUDIENCE_REQUIRED"
);

const evidence = await verifier.verifyCredential({
  credential: fakeJwt(),
  expectedIssuer: ISSUER,
  expectedAudience: AUDIENCE,
});
assert.equal(calls.length, 1);
assert.equal(calls[0].token, fakeJwt());
assert.deepEqual(calls[0].options, {
  jwtKey: PUBLIC_KEY,
  audience: AUDIENCE,
  authorizedParties: AUTHORIZED_PARTIES,
  clockSkewInMs: 0,
  headerType: "JWT",
});
assert.equal("secretKey" in calls[0].options, false);
assert.equal("apiUrl" in calls[0].options, false);
assert.equal("skipJwksCache" in calls[0].options, false);
assert.deepEqual(evidence, {
  verified: true,
  subject: "user_42",
  issuer: ISSUER,
  audience: ["other-service", AUDIENCE],
  sessionReference: "sess_42",
  authenticatedAt: "2026-08-28T17:40:00.000Z",
  expiresAt: "2026-08-28T17:41:00.000Z",
  verificationMethod: "clerk-session-jwt-rs256",
  verificationVersion: "1.0.0",
  active: true,
  revoked: false,
});
assert.equal(Object.isFrozen(evidence), true);
assert.equal(Object.isFrozen(evidence.audience), true);

const rejectingVerifier = createMovieMentorJourneyRecoveryClerkCredentialVerifier({
  jwtKey: PUBLIC_KEY,
  authorizedParties: AUTHORIZED_PARTIES,
  verifyTokenImpl: async () => { throw new Error("bad signature / expired / nbf / azp / kid"); },
});
await expectAsyncCode(
  () => rejectingVerifier.verifyCredential({ credential: fakeJwt(), expectedIssuer: ISSUER, expectedAudience: AUDIENCE }),
  "MOVIE_MENTOR_RECOVERY_CLERK_TOKEN_VERIFICATION_FAILED"
);

for (const mutation of [
  { sub: "", iss: ISSUER, aud: AUDIENCE, sid: "sess", iat: 1787938800, exp: 1787938860, code: "MOVIE_MENTOR_RECOVERY_CLERK_SUBJECT_REQUIRED" },
  { sub: "user", iss: "https://evil.example.com", aud: AUDIENCE, sid: "sess", iat: 1787938800, exp: 1787938860, code: "MOVIE_MENTOR_RECOVERY_CLERK_ISSUER_MISMATCH" },
  { sub: "user", iss: ISSUER, aud: "wrong-audience", sid: "sess", iat: 1787938800, exp: 1787938860, code: "MOVIE_MENTOR_RECOVERY_CLERK_AUDIENCE_MISMATCH" },
  { sub: "user", iss: ISSUER, aud: AUDIENCE, sid: "", iat: 1787938800, exp: 1787938860, code: "MOVIE_MENTOR_RECOVERY_CLERK_SESSION_REFERENCE_REQUIRED" },
  { sub: "user", iss: ISSUER, aud: AUDIENCE, sid: "sess", iat: null, exp: 1787938860, code: "MOVIE_MENTOR_RECOVERY_CLERK_ISSUED_AT_REQUIRED" },
  { sub: "user", iss: ISSUER, aud: AUDIENCE, sid: "sess", iat: 1787938800, exp: null, code: "MOVIE_MENTOR_RECOVERY_CLERK_EXPIRY_REQUIRED" },
]) {
  const { code, ...claims } = mutation;
  const mutatedVerifier = createMovieMentorJourneyRecoveryClerkCredentialVerifier({
    jwtKey: PUBLIC_KEY,
    authorizedParties: AUTHORIZED_PARTIES,
    verifyTokenImpl: async () => claims,
  });
  await expectAsyncCode(
    () => mutatedVerifier.verifyCredential({ credential: fakeJwt(), expectedIssuer: ISSUER, expectedAudience: AUDIENCE }),
    code
  );
}

const server = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
assert.match(server, /MovieMentorJourneyRecoveryProductionBootAssembly\.js/);
assert.doesNotMatch(server, /MovieMentorJourneyRecoveryClerkCredentialVerifier/);
assert.doesNotMatch(server, /verifyCredential:\s*null/);
assert.doesNotMatch(server, /expectedIssuer:\s*null/);
assert.doesNotMatch(server, /expectedAudience:\s*null/);

console.log("[4H.2] pinned Clerk public key required; private key forbidden");
console.log("[4H.2] explicit authorized parties required; wildcard trust forbidden");
console.log("[4H.2] protected header is pinned to RS256 + JWT before provider verification");
console.log("[4H.2] Clerk verifier receives pinned key, exact audience, exact authorized parties, zero clock skew");
console.log("[4H.2] issuer and audience are independently re-checked after provider verification");
console.log("[4H.2] verified Unix timestamps are normalized before the deterministic principal boundary");
console.log("[4H.2] provider rejection and malformed verified claims fail closed");
console.log("[4H.2] server.js cannot import provider verification directly; final boot assembly owns the production path");
console.log("🐔 Zorg: 'I changed alg to none. That means less cryptography to go wrong.'");
console.log("🏏💥 IT ALSO MEANS LESS ZORG TO GO RIGHT.");
console.log("[4H.2] PASS");
