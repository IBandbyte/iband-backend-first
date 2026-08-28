import assert from "node:assert/strict";

import { configureMovieMentorJourneyRecoveryBootMount } from "../ai/MovieMentorJourneyRecoveryBootMountIntegration.js";

function fakeApp({ throwOnUse = false } = {}) {
  const mounts = [];
  return {
    mounts,
    use(path, router) {
      if (throwOnUse) throw Object.assign(new Error("synthetic app.use failure"), { code: "SYNTHETIC_APP_USE_FAILURE" });
      mounts.push({ path, router });
    },
  };
}

function realDeps(overrides = {}) {
  const verifyCredential = async () => ({ verified: true });
  const createRouter = () => Object.freeze({ kind: "router" });
  const activationAuthority = async (request) => ({
    authorized: true,
    ...request,
    activationEpoch: "epoch-1",
    activationReference: "activation-ref-1",
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
    ...overrides,
  };
}

async function expectConflict(fn) {
  await assert.rejects(fn, (error) => error?.code === "MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_ACTIVATION_CONFLICT");
}

console.log("3C.5E.4D — recovery activation integrity torture");

{
  const app = fakeApp();
  const closed = await configureMovieMentorJourneyRecoveryBootMount({
    app,
    verifyCredential: null,
    expectedIssuer: "https://issuer.example.test",
    expectedAudience: "iband.movie-mentor",
  });
  assert.equal(closed.mounted, false);
  const opened = await configureMovieMentorJourneyRecoveryBootMount({ app, ...realDeps() });
  assert.equal(opened.mounted, true);
  assert.equal(app.mounts.length, 1);
}

{
  const app = fakeApp();
  let factoryCalls = 0;
  const createRouter = () => { factoryCalls += 1; return Object.freeze({ kind: "router" }); };
  const deps = realDeps({ createRouter });
  const first = await configureMovieMentorJourneyRecoveryBootMount({ app, ...deps });
  const second = await configureMovieMentorJourneyRecoveryBootMount({ app, ...deps });
  assert.equal(first.mounted, true);
  assert.equal(second.idempotent, true);
  assert.equal(factoryCalls, 1);
  assert.equal(app.mounts.length, 1);
}

{
  const app = fakeApp();
  const deps = realDeps();
  await configureMovieMentorJourneyRecoveryBootMount({ app, ...deps });
  await expectConflict(() => configureMovieMentorJourneyRecoveryBootMount({ app, ...deps, verifyCredential: null }));
  await expectConflict(() => configureMovieMentorJourneyRecoveryBootMount({ app, ...deps, expectedIssuer: "https://zorg.example.test" }));
  await expectConflict(() => configureMovieMentorJourneyRecoveryBootMount({ app, ...deps, expectedAudience: "zorg-audience" }));
  await expectConflict(() => configureMovieMentorJourneyRecoveryBootMount({ app, ...deps, basePath: "/api/other" }));
  await expectConflict(() => configureMovieMentorJourneyRecoveryBootMount({ app, ...deps, processInstanceId: "process-B" }));
  await expectConflict(() => configureMovieMentorJourneyRecoveryBootMount({ app, ...deps, deploymentId: "deploy-2" }));
  assert.equal(app.mounts.length, 1);
}

{
  const app = fakeApp();
  const bad = realDeps({ createRouter: () => { throw Object.assign(new Error("router build failed"), { code: "SYNTHETIC_ROUTER_FACTORY_FAILURE" }); } });
  await assert.rejects(() => configureMovieMentorJourneyRecoveryBootMount({ app, ...bad }));
  assert.equal(app.mounts.length, 0);
  const good = await configureMovieMentorJourneyRecoveryBootMount({ app, ...realDeps() });
  assert.equal(good.mounted, true);
}

console.log("✓ partial configuration never latches false activation");
console.log("✓ exact boot retry cannot double-mount");
console.log("✓ verifier/trust/path/process/deployment drift are conflicts");
console.log("✓ pre-mount construction failure remains retryable");
console.log("3C.5E.4D torture: GREEN");
