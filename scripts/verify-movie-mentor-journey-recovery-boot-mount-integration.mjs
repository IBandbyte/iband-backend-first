import assert from "node:assert/strict";

import {
  MOVIE_MENTOR_JOURNEY_RECOVERY_DEFAULT_BASE_PATH,
  configureMovieMentorJourneyRecoveryBootMount,
} from "../ai/MovieMentorJourneyRecoveryBootMountIntegration.js";

function fakeApp() {
  const mounts = [];
  return { mounts, use(path, router) { mounts.push({ path, router }); } };
}

function crossProcessDeps() {
  const lease = Object.freeze({ authorized: true, processInstanceId: "process-A", deploymentId: "deploy-1", activationEpoch: "epoch-1", activationReference: "activation-ref-1", fencingToken: "fence-1", expiresAt: new Date(Date.now() + 60_000).toISOString() });
  return { processInstanceId: lease.processInstanceId, deploymentId: lease.deploymentId, activationAuthority: async (request) => ({ ...lease, ...request, authorized: true }), renewActivation: async () => lease, assertFence: async () => Object.freeze({ authorized: true, ...lease }) };
}

console.log("3C.5E.4C — recovery boot mount integration torture");

{
  const app = fakeApp();
  const result = await configureMovieMentorJourneyRecoveryBootMount({ app });
  assert.equal(result.mountable, false);assert.equal(result.reason, "verifier-unavailable");assert.equal(app.mounts.length, 0);assert.equal(result.basePath, MOVIE_MENTOR_JOURNEY_RECOVERY_DEFAULT_BASE_PATH);
}

for (const fakeVerifier of [null, true, "enabled", "jwt-secret", { verify: true }]) {
  const app = fakeApp();
  const result = await configureMovieMentorJourneyRecoveryBootMount({ app, verifyCredential: fakeVerifier, expectedIssuer: "https://issuer.example.test", expectedAudience: "iband.movie-mentor" });
  assert.equal(result.mounted, false);assert.equal(result.reason, "verifier-unavailable");assert.equal(app.mounts.length, 0);
}

{
  const verifyCredential = async () => ({ verified: true });
  const appA = fakeApp();const noIssuer = await configureMovieMentorJourneyRecoveryBootMount({ app: appA, verifyCredential, expectedAudience: "iband.movie-mentor" });assert.equal(noIssuer.reason, "issuer-unconfigured");assert.equal(appA.mounts.length, 0);
  const appB = fakeApp();const noAudience = await configureMovieMentorJourneyRecoveryBootMount({ app: appB, verifyCredential, expectedIssuer: "https://issuer.example.test" });assert.equal(noAudience.reason, "audience-unconfigured");assert.equal(appB.mounts.length, 0);
}

{
  const app = fakeApp();const verifyCredential = async () => ({ verified: true });let factoryCalls = 0;
  const router = function certifiedRecoveryRouter(_req,_res,next){ if(typeof next==="function") next(); };
  const result = await configureMovieMentorJourneyRecoveryBootMount({ app, verifyCredential, expectedIssuer: "https://issuer.example.test", expectedAudience: "iband.movie-mentor", basePath: "/api/custom-recovery", createRouter: () => { factoryCalls += 1; return router; }, ...crossProcessDeps() });
  assert.equal(result.mounted, true);assert.equal(factoryCalls, 1);assert.equal(app.mounts.length, 1);assert.equal(app.mounts[0].path, "/api/custom-recovery");
}

await assert.rejects(() => configureMovieMentorJourneyRecoveryBootMount({ app: null }), (error) => error?.code === "MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_APP_REQUIRED");
console.log("✓ no real verifier => boot-safe closed route");console.log("✓ fake auth claims cannot become verifier infrastructure");console.log("✓ explicit issuer/audience remain mandatory");console.log("✓ certified cross-process + live-fence authority permits one server-owned mount");console.log("3C.5E.4C torture: GREEN");
