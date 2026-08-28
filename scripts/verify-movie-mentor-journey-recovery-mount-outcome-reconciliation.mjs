import assert from "node:assert/strict";

import { configureMovieMentorJourneyRecoveryBootMount } from "../ai/MovieMentorJourneyRecoveryBootMountIntegration.js";

function fakeLiveFence() {
  return {
    guardRouter: (router) => router,
    start() {},
    stop() {},
    async assertCurrentAuthority() { return { authorized: true }; },
  };
}

function deps(overrides = {}) {
  const verifyCredential = async () => ({ verified: true });
  const createRouter = () => Object.freeze({ kind: "router" });
  const activationAuthority = async (request) => ({
    authorized: true,
    ...request,
    activationEpoch: "epoch-1",
    activationReference: "activation-ref-1",
    fencingToken: "fence-1",
    expiresAt: "2099-01-01T00:00:00.000Z",
    authorizationSource: "synthetic-mount-reconciliation-authority",
  });
  return {
    verifyCredential,
    expectedIssuer: "https://issuer.example.test",
    expectedAudience: "iband.movie-mentor",
    basePath: "/api/movie-mentor-recovery",
    createRouter,
    processInstanceId: "process-A",
    deploymentId: "deploy-1",
    activationAuthority,
    renewActivation: async () => ({ authorized: true }),
    assertFence: async () => ({ authorized: true }),
    createLiveFence: fakeLiveFence,
    ...overrides,
  };
}

async function expectUncertain(fn) {
  await assert.rejects(fn, (error) => error?.code === "MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_MOUNT_OUTCOME_UNCERTAIN");
}
async function expectConflict(fn) {
  await assert.rejects(fn, (error) => error?.code === "MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_ACTIVATION_CONFLICT");
}

console.log("3C.5E.4E — recovery partial-mount / lost-ack torture");

{
  let useCalls = 0;
  const liveMounts = [];
  const app = {
    use(path, router) {
      useCalls += 1;
      liveMounts.push({ path, router });
      throw Object.assign(new Error("ACK lost after mount committed"), { code: "SYNTHETIC_MOUNT_ACK_LOSS" });
    },
  };
  const config = deps();
  await assert.rejects(() => configureMovieMentorJourneyRecoveryBootMount({ app, ...config }), (error) => error?.code === "SYNTHETIC_MOUNT_ACK_LOSS");
  assert.equal(useCalls, 1);
  assert.equal(liveMounts.length, 1);
  await expectUncertain(() => configureMovieMentorJourneyRecoveryBootMount({ app, ...config }));
  await expectUncertain(() => configureMovieMentorJourneyRecoveryBootMount({ app, ...config }));
  assert.equal(useCalls, 1);
  await expectConflict(() => configureMovieMentorJourneyRecoveryBootMount({ app, ...config, expectedIssuer: "https://zorg.example.test" }));
  await expectConflict(() => configureMovieMentorJourneyRecoveryBootMount({ app, ...config, processInstanceId: "process-B" }));
  assert.equal(useCalls, 1);
}

{
  let useCalls = 0;
  const app = { use() { useCalls += 1; throw new Error("pre-commit looking failure"); } };
  const config = deps();
  await assert.rejects(() => configureMovieMentorJourneyRecoveryBootMount({ app, ...config }));
  assert.equal(useCalls, 1);
  await expectUncertain(() => configureMovieMentorJourneyRecoveryBootMount({ app, ...config }));
  assert.equal(useCalls, 1);
}

{
  let useCalls = 0;
  const app = { use() { useCalls += 1; } };
  const bad = deps({ createRouter: () => { throw Object.assign(new Error("router failed before mount"), { code: "SYNTHETIC_ROUTER_BUILD_FAILURE" }); } });
  await assert.rejects(() => configureMovieMentorJourneyRecoveryBootMount({ app, ...bad }));
  assert.equal(useCalls, 0);
  const good = await configureMovieMentorJourneyRecoveryBootMount({ app, ...deps() });
  assert.equal(good.mounted, true);
  assert.equal(useCalls, 1);
}

console.log("✓ app.use ACK loss cannot trigger blind remount");
console.log("✓ exact uncertain retry is terminal for current app instance");
console.log("✓ dependency/process drift during uncertainty is a conflict");
console.log("✓ pre-app.use failure remains safely retryable");
console.log("✓ fixture supplies the current fenced activation evidence and live-fence contract");
console.log("LAW: uncertainty is not authorization to remount");
console.log("3C.5E.4E torture: GREEN");
