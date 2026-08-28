import assert from "node:assert/strict";
import fs from "node:fs";
import {
  MOVIE_MENTOR_JOURNEY_RECOVERY_PRODUCTION_EXPOSURE_ENV as EXPOSURE_ENV,
  authorizeMovieMentorJourneyRecoveryProductionExposure,
  getMovieMentorJourneyRecoveryProductionExposureAuthorityStatus,
} from "../ai/MovieMentorJourneyRecoveryProductionExposureAuthority.js";

function bootAuthentication(overrides = {}) {
  return Object.freeze({
    ready: true,
    bootWired: true,
    verifyCredential: async () => ({ verified: true }),
    expectedIssuer: "https://clerk.example.test",
    expectedAudience: "movie-mentor-recovery",
    ...overrides,
  });
}

function bootActivation(overrides = {}) {
  return Object.freeze({
    ready: true,
    bootWired: true,
    activationAuthority: async () => ({ authorized: true }),
    renewActivation: async () => ({ authorized: true }),
    assertFence: async () => ({ authorized: true }),
    processInstanceId: "recovery-process-1-test",
    deploymentId: "deployment-test",
    ...overrides,
  });
}

console.log("[4H.5] production recovery exposure authority torture starting");

const auth = bootAuthentication();
const activation = bootActivation();

const absent = authorizeMovieMentorJourneyRecoveryProductionExposure({
  env: {},
  bootAuthentication: auth,
  bootActivation: activation,
});
assert.equal(absent.authorized, false);
assert.equal(absent.reason, "production-recovery-exposure-unconfigured");
assert.equal(absent.exposureEnabled, false);
assert.equal(absent.authenticationReady, true);
assert.equal(absent.activationReady, true);
assert.equal(absent.bootWired, false);
assert.equal(Object.isFrozen(absent), true);

for (const value of ["", "false", "1", "yes", "TRUE", "True", "on", "enabled", "garbage"]) {
  const result = authorizeMovieMentorJourneyRecoveryProductionExposure({
    env: { [EXPOSURE_ENV]: value },
    bootAuthentication: auth,
    bootActivation: activation,
  });
  assert.equal(result.authorized, false, `value ${JSON.stringify(value)} must remain closed`);
  assert.equal(result.exposureEnabled, false);
}

const authCases = [
  null,
  bootAuthentication({ ready: false }),
  bootAuthentication({ bootWired: false }),
  bootAuthentication({ verifyCredential: null }),
  bootAuthentication({ expectedIssuer: "" }),
  bootAuthentication({ expectedAudience: "" }),
];
for (const candidate of authCases) {
  const result = authorizeMovieMentorJourneyRecoveryProductionExposure({
    env: { [EXPOSURE_ENV]: "true" },
    bootAuthentication: candidate,
    bootActivation: activation,
  });
  assert.equal(result.authorized, false);
  assert.equal(result.reason, "production-recovery-boot-authentication-not-ready");
  assert.equal(result.exposureEnabled, true);
  assert.equal(result.authenticationReady, false);
}

const activationCases = [
  null,
  bootActivation({ ready: false }),
  bootActivation({ bootWired: false }),
  bootActivation({ activationAuthority: null }),
  bootActivation({ renewActivation: null }),
  bootActivation({ assertFence: null }),
  bootActivation({ processInstanceId: "" }),
  bootActivation({ deploymentId: "" }),
];
for (const candidate of activationCases) {
  const result = authorizeMovieMentorJourneyRecoveryProductionExposure({
    env: { [EXPOSURE_ENV]: "true" },
    bootAuthentication: auth,
    bootActivation: candidate,
  });
  assert.equal(result.authorized, false);
  assert.equal(result.reason, "production-recovery-boot-activation-not-ready");
  assert.equal(result.exposureEnabled, true);
  assert.equal(result.authenticationReady, true);
  assert.equal(result.activationReady, false);
}

const authorized = authorizeMovieMentorJourneyRecoveryProductionExposure({
  env: { [EXPOSURE_ENV]: " true " },
  bootAuthentication: auth,
  bootActivation: activation,
});
assert.equal(authorized.authorized, true);
assert.equal(authorized.reason, "production-recovery-exposure-authorized");
assert.equal(authorized.exposureEnabled, true);
assert.equal(authorized.authenticationReady, true);
assert.equal(authorized.activationReady, true);
assert.equal(authorized.bootWired, false);
assert.equal(Object.isFrozen(authorized), true);

const absentStatus = getMovieMentorJourneyRecoveryProductionExposureAuthorityStatus({ env: {} });
assert.equal(absentStatus.configured, false);
assert.equal(absentStatus.enabled, false);
assert.equal(absentStatus.bootWired, false);

const falseStatus = getMovieMentorJourneyRecoveryProductionExposureAuthorityStatus({
  env: { [EXPOSURE_ENV]: "false" },
});
assert.equal(falseStatus.configured, true);
assert.equal(falseStatus.enabled, false);

const trueStatus = getMovieMentorJourneyRecoveryProductionExposureAuthorityStatus({
  env: { [EXPOSURE_ENV]: "true" },
});
assert.equal(trueStatus.configured, true);
assert.equal(trueStatus.enabled, true);
assert.equal(trueStatus.requiredValue, "true");

const server = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
assert.match(server, /verifyCredential:\s*null/);
assert.match(server, /expectedIssuer:\s*null/);
assert.match(server, /expectedAudience:\s*null/);
assert.doesNotMatch(server, /MovieMentorJourneyRecoveryProductionExposureAuthority/);
assert.doesNotMatch(server, /MOVIE_MENTOR_RECOVERY_EXPOSURE_ENABLED/);

console.log("[4H.5] missing exposure configuration remains closed even when both boot authorities are ready");
console.log("[4H.5] only the exact affirmative value 'true' authorizes exposure");
console.log("[4H.5] incomplete boot authentication cannot be converted into exposure authority");
console.log("[4H.5] incomplete activation/live-fence authority cannot be converted into exposure authority");
console.log("[4H.5] readiness and permission remain separate constitutional facts");
console.log("[4H.5] server.js remains untouched; all three authentication nulls still stand guard");
console.log("🐔 Zorg: 'What about TRUE? Same letters, more confidence.'");
console.log("🏏💥 SECURITY IS NOT CASE-INSENSITIVE ENTHUSIASM, ZORG.");
console.log("[4H.5] PASS");
