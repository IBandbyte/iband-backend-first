import assert from "node:assert/strict";

import { authorizeMovieMentorJourneyRecoveryProcessActivation } from "../ai/MovieMentorJourneyRecoveryCrossProcessActivationBoundary.js";
import { configureMovieMentorJourneyRecoveryBootMount } from "../ai/MovieMentorJourneyRecoveryBootMountIntegration.js";

function app() {
  const mounts = [];
  return { mounts, use(path, router) { mounts.push({ path, router }); } };
}

function fakeLiveFence() {
  return {
    guardRouter: (router) => router,
    start() {},
    stop() {},
    async assertCurrentAuthority() { return { authorized: true }; },
  };
}

function base(processInstanceId, activationAuthority) {
  return {
    verifyCredential: async () => ({ verified: true }),
    expectedIssuer: "https://issuer.example.test",
    expectedAudience: "iband.movie-mentor",
    basePath: "/api/movie-mentor-recovery",
    createRouter: () => Object.freeze({ kind: "router", processInstanceId }),
    processInstanceId,
    deploymentId: "deploy-42",
    activationAuthority,
    renewActivation: async () => ({ authorized: true }),
    assertFence: async () => ({ authorized: true }),
    createLiveFence: fakeLiveFence,
  };
}

console.log("3C.5E.4F — cross-process / restart activation reality torture");

{
  const denied = await authorizeMovieMentorJourneyRecoveryProcessActivation({
    processInstanceId: "process-A",
    deploymentId: "deploy-42",
    basePath: "/api/movie-mentor-recovery",
    expectedIssuer: "https://issuer.example.test",
    expectedAudience: "iband.movie-mentor",
  });
  assert.equal(denied.authorized, false);
  assert.equal(denied.reason, "cross-process-activation-authority-unavailable");
}

{
  let authorityCalls = 0;
  const currentApp = app();
  const result = await configureMovieMentorJourneyRecoveryBootMount({
    app: currentApp,
    verifyCredential: null,
    activationAuthority: async () => { authorityCalls += 1; return { authorized: true }; },
  });
  assert.equal(result.reason, "verifier-unavailable");
  assert.equal(authorityCalls, 0);
  assert.equal(currentApp.mounts.length, 0);
}

let holder = null;
let epoch = 0;
const coordinator = async (request) => {
  if (holder !== null && holder !== request.processInstanceId) {
    return { authorized: false };
  }
  holder = request.processInstanceId;
  epoch += 1;
  return {
    authorized: true,
    ...request,
    activationEpoch: `epoch-${epoch}`,
    activationReference: `lease-${request.processInstanceId}-${epoch}`,
    fencingToken: `fence-${request.processInstanceId}-${epoch}`,
    expiresAt: "2099-01-01T00:00:00.000Z",
    authorizationSource: "synthetic-exclusive-coordinator",
  };
};

const processAApp = app();
const processA = await configureMovieMentorJourneyRecoveryBootMount({
  app: processAApp,
  ...base("process-A", coordinator),
});
assert.equal(processA.mounted, true);
assert.equal(processAApp.mounts.length, 1);

const processBApp = app();
const processBDenied = await configureMovieMentorJourneyRecoveryBootMount({
  app: processBApp,
  ...base("process-B", coordinator),
});
assert.equal(processBDenied.mounted, false);
assert.equal(processBDenied.reason, "cross-process-activation-not-authorized");
assert.equal(processBApp.mounts.length, 0);

holder = null;
const processBAllowed = await configureMovieMentorJourneyRecoveryBootMount({
  app: processBApp,
  ...base("process-B", coordinator),
});
assert.equal(processBAllowed.mounted, true);
assert.equal(processBApp.mounts.length, 1);

{
  const evilApp = app();
  const forgedAuthority = async (request) => ({
    authorized: true,
    ...request,
    processInstanceId: "different-process",
    activationEpoch: "epoch-zorg",
    activationReference: "lease-zorg",
    fencingToken: "fence-zorg",
    expiresAt: "2099-01-01T00:00:00.000Z",
    authorizationSource: "synthetic-forged-authority",
  });
  const denied = await configureMovieMentorJourneyRecoveryBootMount({
    app: evilApp,
    ...base("process-C", forgedAuthority),
  });
  assert.equal(denied.reason, "cross-process-activation-binding-conflict");
  assert.equal(evilApp.mounts.length, 0);
}

{
  const orphanApp = app();
  const result = await configureMovieMentorJourneyRecoveryBootMount({
    app: orphanApp,
    ...base("process-orphan", null),
  });
  assert.equal(result.reason, "cross-process-activation-authority-unavailable");
  assert.equal(orphanApp.mounts.length, 0);
}

console.log("✓ process-local absence cannot prove service-level absence");
console.log("✓ fresh process needs externally authorized activation reality");
console.log("✓ overlapping process is denied while predecessor remains holder");
console.log("✓ explicit handoff permits restart activation");
console.log("✓ forged process/deployment binding is rejected");
console.log("✓ verifier alone cannot authorize cross-process remount");
console.log("✓ fixture carries the current fenced activation evidence and live-fence contract");
console.log("LAW: restart is not authority to remount");
console.log("3C.5E.4F torture: GREEN");
