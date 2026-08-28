import assert from "node:assert/strict";

import {
  MOVIE_MENTOR_JOURNEY_RECOVERY_DEFAULT_BASE_PATH,
  configureMovieMentorJourneyRecoveryBootMount,
} from "../ai/MovieMentorJourneyRecoveryBootMountIntegration.js";

function fakeApp() {
  const mounts = [];
  return {
    mounts,
    use(path, router) {
      mounts.push({ path, router });
    },
  };
}

console.log("3C.5E.4C — recovery boot mount integration torture");

// Current production reality: no real verifier. Boot succeeds; route stays closed.
{
  const app = fakeApp();
  const result = configureMovieMentorJourneyRecoveryBootMount({ app });
  assert.equal(result.mountable, false);
  assert.equal(result.mounted, false);
  assert.equal(result.reason, "verifier-unavailable");
  assert.equal(app.mounts.length, 0);
  assert.equal(result.basePath, MOVIE_MENTOR_JOURNEY_RECOVERY_DEFAULT_BASE_PATH);
  assert.ok(Object.isFrozen(result));
}

// Env/body-shaped claims do not substitute for an injected verifier function.
for (const fakeVerifier of [null, true, "enabled", "jwt-secret", { verify: true }]) {
  const app = fakeApp();
  const result = configureMovieMentorJourneyRecoveryBootMount({
    app,
    verifyCredential: fakeVerifier,
    expectedIssuer: "https://issuer.example.test",
    expectedAudience: "iband.movie-mentor",
    env: { AUTH: "true" },
    request: { body: { authenticated: true, admin: true, trustMeBro: true } },
  });
  assert.equal(result.mounted, false);
  assert.equal(result.reason, "verifier-unavailable");
  assert.equal(app.mounts.length, 0);
}

// Even with a real verifier, trust policy must be explicit.
{
  const verifyCredential = async () => ({ verified: true });
  const appA = fakeApp();
  const noIssuer = configureMovieMentorJourneyRecoveryBootMount({
    app: appA,
    verifyCredential,
    expectedAudience: "iband.movie-mentor",
  });
  assert.equal(noIssuer.reason, "issuer-unconfigured");
  assert.equal(appA.mounts.length, 0);

  const appB = fakeApp();
  const noAudience = configureMovieMentorJourneyRecoveryBootMount({
    app: appB,
    verifyCredential,
    expectedIssuer: "https://issuer.example.test",
  });
  assert.equal(noAudience.reason, "audience-unconfigured");
  assert.equal(appB.mounts.length, 0);
}

// Full dependency set mounts exactly once at the server-owned base path.
{
  const app = fakeApp();
  const verifyCredential = async () => ({ verified: true });
  let factoryCalls = 0;
  let received = null;
  const router = Object.freeze({ kind: "certified-router" });

  const result = configureMovieMentorJourneyRecoveryBootMount({
    app,
    verifyCredential,
    expectedIssuer: "https://issuer.example.test",
    expectedAudience: "iband.movie-mentor",
    basePath: "/api/custom-recovery",
    createRouter: (args) => {
      factoryCalls += 1;
      received = args;
      return router;
    },
  });

  assert.equal(result.mountable, true);
  assert.equal(result.mounted, true);
  assert.equal(factoryCalls, 1);
  assert.equal(app.mounts.length, 1);
  assert.equal(app.mounts[0].path, "/api/custom-recovery");
  assert.equal(app.mounts[0].router, router);
  assert.equal(received.verifyCredential, verifyCredential);
  assert.equal(received.expectedIssuer, "https://issuer.example.test");
  assert.equal(received.expectedAudience, "iband.movie-mentor");
}

// Invalid application is a boot wiring error, not an excuse to silently mount elsewhere.
assert.throws(
  () => configureMovieMentorJourneyRecoveryBootMount({ app: null }),
  (error) => error?.code === "MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_APP_REQUIRED",
);

console.log("✓ no real verifier => boot-safe closed route");
console.log("✓ body/env claims cannot become authentication infrastructure");
console.log("✓ explicit issuer and audience remain mandatory");
console.log("✓ complete dependency set mounts exactly once at server-owned path");
console.log("✓ boot integration delegates mount authority to certified 4A gate");
console.log("3C.5E.4C torture: GREEN");
