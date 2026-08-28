import assert from "node:assert/strict";
import fs from "node:fs";
import {
  MOVIE_MENTOR_JOURNEY_RECOVERY_PRODUCTION_AUTHENTICATION_ENV as ENV,
  createMovieMentorJourneyRecoveryProductionAuthenticationComposition,
  getMovieMentorJourneyRecoveryProductionAuthenticationCompositionStatus,
} from "../ai/MovieMentorJourneyRecoveryProductionAuthenticationComposition.js";

function expectCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code);
}

const PUBLIC_KEY = "-----BEGIN PUBLIC KEY-----\\nABC\\n-----END PUBLIC KEY-----";
const COMPLETE_ENV = Object.freeze({
  [ENV.jwtKey]: PUBLIC_KEY,
  [ENV.authorizedParties]: JSON.stringify([
    "https://movie.example.test",
    "https://studio.example.test",
  ]),
  [ENV.expectedIssuer]: "https://clerk.example.test",
  [ENV.expectedAudience]: "movie-mentor-recovery",
});

console.log("[4H.3] production authentication composition torture starting");

const absent = createMovieMentorJourneyRecoveryProductionAuthenticationComposition({ env: {} });
assert.equal(absent.ready, false);
assert.equal(absent.reason, "production-authentication-unconfigured");
assert.equal(absent.verifyCredential, null);
assert.equal(absent.expectedIssuer, null);
assert.equal(absent.expectedAudience, null);
assert.equal(absent.bootWired, false);
assert.equal(Object.isFrozen(absent), true);

for (const missing of Object.values(ENV)) {
  const partial = { ...COMPLETE_ENV };
  delete partial[missing];
  const result = createMovieMentorJourneyRecoveryProductionAuthenticationComposition({ env: partial });
  assert.equal(result.ready, false);
  assert.equal(result.reason, "production-authentication-partially-configured");
  assert.equal(result.verifyCredential, null);
  assert.equal(result.expectedIssuer, null);
  assert.equal(result.expectedAudience, null);
}

expectCode(
  () => createMovieMentorJourneyRecoveryProductionAuthenticationComposition({
    env: { ...COMPLETE_ENV, [ENV.authorizedParties]: "not-json" },
  }),
  "MOVIE_MENTOR_RECOVERY_PRODUCTION_AUTHENTICATION_AUTHORIZED_PARTIES_JSON_INVALID"
);
expectCode(
  () => createMovieMentorJourneyRecoveryProductionAuthenticationComposition({
    env: { ...COMPLETE_ENV, [ENV.authorizedParties]: "[]" },
  }),
  "MOVIE_MENTOR_RECOVERY_PRODUCTION_AUTHENTICATION_AUTHORIZED_PARTIES_REQUIRED"
);

for (const wildcard of ["*", "all", "any", "everyone"]) {
  expectCode(
    () => createMovieMentorJourneyRecoveryProductionAuthenticationComposition({
      env: { ...COMPLETE_ENV, [ENV.expectedIssuer]: wildcard },
    }),
    "MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHENTICATION_ISSUER_WILDCARD_FORBIDDEN"
  );
  expectCode(
    () => createMovieMentorJourneyRecoveryProductionAuthenticationComposition({
      env: { ...COMPLETE_ENV, [ENV.expectedAudience]: wildcard },
    }),
    "MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHENTICATION_AUDIENCE_WILDCARD_FORBIDDEN"
  );
}

expectCode(
  () => createMovieMentorJourneyRecoveryProductionAuthenticationComposition({
    env: { ...COMPLETE_ENV, [ENV.authorizedParties]: JSON.stringify(["*"]) },
  }),
  "MOVIE_MENTOR_RECOVERY_CLERK_AUTHORIZED_PARTY_INVALID"
);
expectCode(
  () => createMovieMentorJourneyRecoveryProductionAuthenticationComposition({
    env: { ...COMPLETE_ENV, [ENV.jwtKey]: "-----BEGIN PRIVATE KEY-----\\nNOPE\\n-----END PRIVATE KEY-----" },
  }),
  "MOVIE_MENTOR_RECOVERY_CLERK_PRIVATE_KEY_FORBIDDEN"
);

let verifierInput = null;
let authorityInput = null;
const fakeVerifier = async () => ({ verified: true });
const composed = createMovieMentorJourneyRecoveryProductionAuthenticationComposition({
  env: COMPLETE_ENV,
  createVerifier(input) {
    verifierInput = input;
    return Object.freeze({
      version: "test-verifier",
      domain: "test.verifier",
      authorizedParties: Object.freeze(["https://movie.example.test", "https://studio.example.test"]),
      verifyCredential: fakeVerifier,
    });
  },
  createConfigurationAuthority(input) {
    authorityInput = input;
    return Object.freeze({
      ready: true,
      verifyCredential: input.verifyCredential,
      expectedIssuer: input.expectedIssuer.trim(),
      expectedAudience: input.expectedAudience.trim(),
    });
  },
});
assert.match(verifierInput.jwtKey, /BEGIN PUBLIC KEY/);
assert.match(verifierInput.jwtKey, /\nABC\n/);
assert.deepEqual(verifierInput.authorizedParties, ["https://movie.example.test", "https://studio.example.test"]);
assert.equal(authorityInput.verifyCredential, fakeVerifier);
assert.equal(authorityInput.expectedIssuer, "https://clerk.example.test");
assert.equal(authorityInput.expectedAudience, "movie-mentor-recovery");
assert.equal(composed.ready, true);
assert.equal(composed.reason, "production-authentication-composed");
assert.equal(composed.provider, "clerk");
assert.equal(composed.verifyCredential, fakeVerifier);
assert.equal(composed.expectedIssuer, "https://clerk.example.test");
assert.equal(composed.expectedAudience, "movie-mentor-recovery");
assert.equal(composed.bootWired, false);
assert.equal(Object.isFrozen(composed), true);
assert.equal(Object.isFrozen(composed.authorizedParties), true);

const realComposition = createMovieMentorJourneyRecoveryProductionAuthenticationComposition({ env: COMPLETE_ENV });
assert.equal(realComposition.ready, true);
assert.equal(typeof realComposition.verifyCredential, "function");
assert.equal(realComposition.expectedIssuer, "https://clerk.example.test");
assert.equal(realComposition.expectedAudience, "movie-mentor-recovery");
assert.deepEqual(realComposition.authorizedParties, ["https://movie.example.test", "https://studio.example.test"]);

const absentStatus = getMovieMentorJourneyRecoveryProductionAuthenticationCompositionStatus({ env: {} });
assert.equal(absentStatus.ready, false);
assert.equal(absentStatus.configured, false);
assert.equal(absentStatus.partiallyConfigured, false);
assert.equal(absentStatus.bootWired, false);

const partialStatus = getMovieMentorJourneyRecoveryProductionAuthenticationCompositionStatus({
  env: { [ENV.expectedAudience]: "movie-mentor-recovery" },
});
assert.equal(partialStatus.ready, false);
assert.equal(partialStatus.partiallyConfigured, true);

const readyStatus = getMovieMentorJourneyRecoveryProductionAuthenticationCompositionStatus({ env: COMPLETE_ENV });
assert.equal(readyStatus.ready, true);
assert.equal(readyStatus.configured, true);
assert.equal(readyStatus.partiallyConfigured, false);
assert.equal(readyStatus.bootWired, false);

expectCode(
  () => createMovieMentorJourneyRecoveryProductionAuthenticationComposition({
    env: COMPLETE_ENV,
    createVerifier: null,
  }),
  "MOVIE_MENTOR_RECOVERY_PRODUCTION_AUTHENTICATION_FACTORIES_REQUIRED"
);
expectCode(
  () => createMovieMentorJourneyRecoveryProductionAuthenticationComposition({
    env: COMPLETE_ENV,
    createVerifier: () => Object.freeze({}),
  }),
  "MOVIE_MENTOR_RECOVERY_PRODUCTION_AUTHENTICATION_VERIFIER_INVALID"
);
expectCode(
  () => createMovieMentorJourneyRecoveryProductionAuthenticationComposition({
    env: COMPLETE_ENV,
    createVerifier: () => Object.freeze({ verifyCredential: fakeVerifier }),
    createConfigurationAuthority: () => Object.freeze({ ready: false }),
  }),
  "MOVIE_MENTOR_RECOVERY_PRODUCTION_AUTHENTICATION_AUTHORITY_INVALID"
);

const server = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
assert.match(server, /MovieMentorJourneyRecoveryProductionBootAssembly\.js/);
assert.doesNotMatch(server, /MovieMentorJourneyRecoveryProductionAuthenticationComposition/);
assert.doesNotMatch(server, /verifyCredential:\s*null/);
assert.doesNotMatch(server, /expectedIssuer:\s*null/);
assert.doesNotMatch(server, /expectedAudience:\s*null/);

console.log("[4H.3] absent and partial production auth environment leaks zero authority");
console.log("[4H.3] authorized parties require strict non-empty JSON and Clerk validation");
console.log("[4H.3] private keys and wildcard trust remain forbidden downstream");
console.log("[4H.3] escaped PEM newlines normalize before verifier construction");
console.log("[4H.3] verifier -> configuration authority composition preserves exact dependencies");
console.log("[4H.3] composition status exposes readiness without exposing trust material");
console.log("[4H.3] server.js reaches production authentication only through the final certified boot assembly");
console.log("🐔 Zorg: 'I wasn't touching the nulls. I was hovering.'");
console.log("🏏💥 THE NULLS ARE GONE, ZORG. NOW BACK AWAY FROM THE ASSEMBLY.");
console.log("[4H.3] PASS");
