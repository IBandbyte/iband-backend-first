import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createMovieMentorJourneyRecoveryAuthenticationConfigurationAuthority,
  getMovieMentorJourneyRecoveryAuthenticationConfigurationAuthorityStatus,
} from "../ai/MovieMentorJourneyRecoveryAuthenticationConfigurationAuthority.js";

function expectCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code);
}

console.log("[4H.1] authentication configuration authority torture starting");

const absent = createMovieMentorJourneyRecoveryAuthenticationConfigurationAuthority();
assert.equal(absent.ready, false);
assert.equal(absent.reason, "authentication-unconfigured");
assert.equal(absent.verifyCredential, null);
assert.equal(absent.expectedIssuer, null);
assert.equal(absent.expectedAudience, null);

const verifier = async () => ({ verified: true });

for (const partial of [
  { verifyCredential: verifier },
  { expectedIssuer: "issuer-a" },
  { expectedAudience: "audience-a" },
  { verifyCredential: verifier, expectedIssuer: "issuer-a" },
  { verifyCredential: verifier, expectedAudience: "audience-a" },
  { expectedIssuer: "issuer-a", expectedAudience: "audience-a" },
]) {
  const result = createMovieMentorJourneyRecoveryAuthenticationConfigurationAuthority(partial);
  assert.equal(result.ready, false);
  assert.equal(result.reason, "authentication-partially-configured");
  assert.equal(result.verifyCredential, null);
  assert.equal(result.expectedIssuer, null);
  assert.equal(result.expectedAudience, null);
}

for (const wildcard of ["*", "all", "any", "everyone", " ALL "]) {
  expectCode(
    () => createMovieMentorJourneyRecoveryAuthenticationConfigurationAuthority({
      verifyCredential: verifier,
      expectedIssuer: wildcard,
      expectedAudience: "movie-mentor-recovery",
    }),
    "MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHENTICATION_ISSUER_WILDCARD_FORBIDDEN"
  );

  expectCode(
    () => createMovieMentorJourneyRecoveryAuthenticationConfigurationAuthority({
      verifyCredential: verifier,
      expectedIssuer: "https://identity.example.test",
      expectedAudience: wildcard,
    }),
    "MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHENTICATION_AUDIENCE_WILDCARD_FORBIDDEN"
  );
}

const ready = createMovieMentorJourneyRecoveryAuthenticationConfigurationAuthority({
  verifyCredential: verifier,
  expectedIssuer: "  https://identity.example.test  ",
  expectedAudience: "  movie-mentor-recovery  ",
});
assert.equal(ready.ready, true);
assert.equal(ready.reason, "authentication-configuration-authoritative");
assert.equal(ready.verifyCredential, verifier);
assert.equal(ready.expectedIssuer, "https://identity.example.test");
assert.equal(ready.expectedAudience, "movie-mentor-recovery");
assert.equal(Object.isFrozen(ready), true);

const status = getMovieMentorJourneyRecoveryAuthenticationConfigurationAuthorityStatus(ready);
assert.equal(status.ready, true);
assert.equal(status.verifierConfigured, true);
assert.equal(status.issuerConfigured, true);
assert.equal(status.audienceConfigured, true);
assert.equal(status.bootWired, false);
assert.equal(Object.isFrozen(status), true);

const server = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
assert.match(server, /MovieMentorJourneyRecoveryProductionBootAssembly\.js/);
assert.doesNotMatch(server, /MovieMentorJourneyRecoveryAuthenticationConfigurationAuthority/);
assert.doesNotMatch(server, /verifyCredential:\s*null/);
assert.doesNotMatch(server, /expectedIssuer:\s*null/);
assert.doesNotMatch(server, /expectedAudience:\s*null/);

console.log("[4H.1] missing authentication configuration stays closed");
console.log("[4H.1] partial authentication configuration leaks zero authority");
console.log("[4H.1] wildcard issuer/audience trust is forbidden");
console.log("[4H.1] complete explicit configuration preserves exact verifier dependency");
console.log("[4H.1] final server exposure may reach authentication only through the certified production boot assembly");
console.log("🐔 Zorg: 'But everyone is technically an audience.'");
console.log("🏏💥 NOT IN AN AUTHENTICATION POLICY, ZORG.");
console.log("[4H.1] PASS");
