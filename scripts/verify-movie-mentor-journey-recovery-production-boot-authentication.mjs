import assert from "node:assert/strict";
import fs from "node:fs";
import {
  MOVIE_MENTOR_JOURNEY_RECOVERY_PRODUCTION_AUTHENTICATION_ENV as ENV,
} from "../ai/MovieMentorJourneyRecoveryProductionAuthenticationComposition.js";
import {
  createMovieMentorJourneyRecoveryProductionBootAuthentication,
  getMovieMentorJourneyRecoveryProductionBootAuthenticationStatus,
} from "../ai/MovieMentorJourneyRecoveryProductionBootAuthentication.js";

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

console.log("[4H.4] production boot authentication torture starting");

const absent = createMovieMentorJourneyRecoveryProductionBootAuthentication({ env: {} });
assert.equal(absent.ready, false);
assert.equal(absent.reason, "production-authentication-composition-not-ready");
assert.equal(absent.verifyCredential, null);
assert.equal(absent.expectedIssuer, null);
assert.equal(absent.expectedAudience, null);
assert.deepEqual(absent.authorizedParties, []);
assert.equal(absent.bootWired, true);
assert.equal(Object.isFrozen(absent), true);
assert.equal(Object.isFrozen(absent.authorizedParties), true);

const partial = createMovieMentorJourneyRecoveryProductionBootAuthentication({
  env: { [ENV.expectedAudience]: "movie-mentor-recovery" },
});
assert.equal(partial.ready, false);
assert.equal(partial.verifyCredential, null);
assert.equal(partial.expectedIssuer, null);
assert.equal(partial.expectedAudience, null);
assert.equal(partial.bootWired, true);
assert.equal(partial.compositionStatus?.partiallyConfigured, true);

let createCalls = 0;
const closedFromStatus = createMovieMentorJourneyRecoveryProductionBootAuthentication({
  env: COMPLETE_ENV,
  getCompositionStatus: () => Object.freeze({ ready: false, configured: false }),
  createComposition: () => {
    createCalls += 1;
    throw new Error("must not construct when status is closed");
  },
});
assert.equal(closedFromStatus.ready, false);
assert.equal(createCalls, 0);

expectCode(
  () => createMovieMentorJourneyRecoveryProductionBootAuthentication({
    env: COMPLETE_ENV,
    createComposition: null,
  }),
  "MOVIE_MENTOR_RECOVERY_PRODUCTION_BOOT_AUTHENTICATION_COMPOSITION_REQUIRED"
);
expectCode(
  () => createMovieMentorJourneyRecoveryProductionBootAuthentication({
    env: COMPLETE_ENV,
    getCompositionStatus: null,
  }),
  "MOVIE_MENTOR_RECOVERY_PRODUCTION_BOOT_AUTHENTICATION_COMPOSITION_REQUIRED"
);
expectCode(
  () => getMovieMentorJourneyRecoveryProductionBootAuthenticationStatus({
    env: COMPLETE_ENV,
    getCompositionStatus: null,
  }),
  "MOVIE_MENTOR_RECOVERY_PRODUCTION_BOOT_AUTHENTICATION_STATUS_REQUIRED"
);

const fakeVerifier = async () => ({ verified: true });
const readyStatus = Object.freeze({ ready: true, configured: true });
const invalidCompositions = [
  null,
  {},
  { ready: false },
  { ready: true, verifyCredential: null, expectedIssuer: "issuer", expectedAudience: "audience", provider: "clerk", authorizedParties: ["party"] },
  { ready: true, verifyCredential: fakeVerifier, expectedIssuer: "", expectedAudience: "audience", provider: "clerk", authorizedParties: ["party"] },
  { ready: true, verifyCredential: fakeVerifier, expectedIssuer: "issuer", expectedAudience: "", provider: "clerk", authorizedParties: ["party"] },
  { ready: true, verifyCredential: fakeVerifier, expectedIssuer: "issuer", expectedAudience: "audience", provider: "other", authorizedParties: ["party"] },
  { ready: true, verifyCredential: fakeVerifier, expectedIssuer: "issuer", expectedAudience: "audience", provider: "clerk", authorizedParties: [] },
];
for (const composition of invalidCompositions) {
  expectCode(
    () => createMovieMentorJourneyRecoveryProductionBootAuthentication({
      env: COMPLETE_ENV,
      getCompositionStatus: () => readyStatus,
      createComposition: () => composition,
    }),
    "MOVIE_MENTOR_RECOVERY_PRODUCTION_BOOT_AUTHENTICATION_COMPOSITION_INVALID"
  );
}

let statusEnv = null;
let compositionEnv = null;
const fakeComposition = Object.freeze({
  version: "test-composition",
  domain: "test.composition",
  ready: true,
  provider: "clerk",
  verifyCredential: fakeVerifier,
  expectedIssuer: " https://clerk.example.test ",
  expectedAudience: " movie-mentor-recovery ",
  authorizedParties: Object.freeze([
    "https://movie.example.test",
    "https://studio.example.test",
  ]),
  bootWired: false,
});
const wired = createMovieMentorJourneyRecoveryProductionBootAuthentication({
  env: COMPLETE_ENV,
  getCompositionStatus({ env }) {
    statusEnv = env;
    return readyStatus;
  },
  createComposition({ env }) {
    compositionEnv = env;
    return fakeComposition;
  },
});
assert.equal(statusEnv, COMPLETE_ENV);
assert.equal(compositionEnv, COMPLETE_ENV);
assert.equal(wired.ready, true);
assert.equal(wired.reason, "certified-production-authentication-composition-wired-for-boot");
assert.equal(wired.provider, "clerk");
assert.equal(wired.verifyCredential, fakeVerifier);
assert.equal(wired.expectedIssuer, "https://clerk.example.test");
assert.equal(wired.expectedAudience, "movie-mentor-recovery");
assert.deepEqual(wired.authorizedParties, ["https://movie.example.test", "https://studio.example.test"]);
assert.equal(wired.compositionVersion, "test-composition");
assert.equal(wired.compositionDomain, "test.composition");
assert.equal(wired.bootWired, true);
assert.equal(fakeComposition.bootWired, false);
assert.equal(Object.isFrozen(wired), true);
assert.equal(Object.isFrozen(wired.authorizedParties), true);
assert.notEqual(wired.authorizedParties, fakeComposition.authorizedParties);

const realWired = createMovieMentorJourneyRecoveryProductionBootAuthentication({ env: COMPLETE_ENV });
assert.equal(realWired.ready, true);
assert.equal(realWired.provider, "clerk");
assert.equal(typeof realWired.verifyCredential, "function");
assert.equal(realWired.expectedIssuer, "https://clerk.example.test");
assert.equal(realWired.expectedAudience, "movie-mentor-recovery");
assert.deepEqual(realWired.authorizedParties, ["https://movie.example.test", "https://studio.example.test"]);
assert.equal(realWired.bootWired, true);

const absentStatus = getMovieMentorJourneyRecoveryProductionBootAuthenticationStatus({ env: {} });
assert.equal(absentStatus.ready, false);
assert.equal(absentStatus.compositionReady, false);
assert.equal(absentStatus.bootWired, true);

const realReadyStatus = getMovieMentorJourneyRecoveryProductionBootAuthenticationStatus({ env: COMPLETE_ENV });
assert.equal(realReadyStatus.ready, true);
assert.equal(realReadyStatus.compositionReady, true);
assert.equal(realReadyStatus.provider, "clerk");
assert.equal(realReadyStatus.bootWired, true);

const server = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
assert.match(server, /MovieMentorJourneyRecoveryProductionBootAssembly\.js/);
assert.doesNotMatch(server, /MovieMentorJourneyRecoveryProductionBootAuthentication/);
assert.doesNotMatch(server, /createMovieMentorJourneyRecoveryProductionAuthenticationComposition/);
assert.doesNotMatch(server, /verifyCredential:\s*null/);
assert.doesNotMatch(server, /expectedIssuer:\s*null/);
assert.doesNotMatch(server, /expectedAudience:\s*null/);

const assembly = fs.readFileSync(new URL("../ai/MovieMentorJourneyRecoveryProductionBootAssembly.js", import.meta.url), "utf8");
assert.match(assembly, /MovieMentorJourneyRecoveryProductionBootAuthentication\.js/);
assert.match(assembly, /verifyCredential:\s*bootAuthentication\?\.verifyCredential/);
assert.match(assembly, /expectedIssuer:\s*bootAuthentication\?\.expectedIssuer/);
assert.match(assembly, /expectedAudience:\s*bootAuthentication\?\.expectedAudience/);

console.log("[4H.4] absent and partial composition readiness leaks zero boot authentication authority");
console.log("[4H.4] closed status prevents composition construction");
console.log("[4H.4] malformed ready composition cannot manufacture boot authority");
console.log("[4H.4] exact verifier, issuer, audience and authorized parties cross the boot adapter boundary");
console.log("[4H.4] composition remains bootWired=false while the explicit adapter becomes bootWired=true");
console.log("[4H.4] final production assembly consumes the certified boot adapter; server.js never manufactures auth authority");
console.log("🐔 Zorg: 'You built the wire. Surely I can plug it in now.'");
console.log("🏏💥 ONLY THE FINAL ASSEMBLY GETS THE SOCKET, ZORG.");
console.log("[4H.4] PASS");
