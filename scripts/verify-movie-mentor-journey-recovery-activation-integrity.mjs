import assert from "node:assert/strict";

import {
  configureMovieMentorJourneyRecoveryBootMount,
} from "../ai/MovieMentorJourneyRecoveryBootMountIntegration.js";

function fakeApp({ throwOnUse = false } = {}) {
  const mounts = [];
  return {
    mounts,
    use(path, router) {
      if (throwOnUse) {
        throw Object.assign(new Error("synthetic app.use failure"), {
          code: "SYNTHETIC_APP_USE_FAILURE",
        });
      }
      mounts.push({ path, router });
    },
  };
}

function realDeps(overrides = {}) {
  const verifyCredential = async () => ({ verified: true });
  const createRouter = () => Object.freeze({ kind: "router" });
  return {
    verifyCredential,
    expectedIssuer: "https://issuer.example.test",
    expectedAudience: "iband.movie-mentor",
    basePath: "/api/movie-mentor-recovery",
    createRouter,
    ...overrides,
  };
}

function expectConflict(fn) {
  assert.throws(
    fn,
    (error) =>
      error?.code === "MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_ACTIVATION_CONFLICT",
  );
}

console.log("3C.5E.4D — recovery activation integrity torture");

// Partial configuration stays closed and does not poison future valid activation.
{
  const app = fakeApp();
  const closed = configureMovieMentorJourneyRecoveryBootMount({
    app,
    verifyCredential: null,
    expectedIssuer: "https://issuer.example.test",
    expectedAudience: "iband.movie-mentor",
  });
  assert.equal(closed.mounted, false);
  assert.equal(app.mounts.length, 0);

  const deps = realDeps();
  const opened = configureMovieMentorJourneyRecoveryBootMount({ app, ...deps });
  assert.equal(opened.mounted, true);
  assert.equal(opened.idempotent, false);
  assert.equal(app.mounts.length, 1);
}

// Exact repeated boot is idempotent: no second router construction and no app.use.
{
  const app = fakeApp();
  const verifyCredential = async () => ({ verified: true });
  let factoryCalls = 0;
  const createRouter = () => {
    factoryCalls += 1;
    return Object.freeze({ kind: "router" });
  };
  const deps = realDeps({ verifyCredential, createRouter });

  const first = configureMovieMentorJourneyRecoveryBootMount({ app, ...deps });
  const second = configureMovieMentorJourneyRecoveryBootMount({ app, ...deps });

  assert.equal(first.mounted, true);
  assert.equal(first.idempotent, false);
  assert.equal(second.mounted, true);
  assert.equal(second.idempotent, true);
  assert.equal(second.reason, "already-mounted-with-identical-activation");
  assert.equal(factoryCalls, 1);
  assert.equal(app.mounts.length, 1);
}

// Once mounted, every authority/configuration downgrade or drift is rejected.
{
  const app = fakeApp();
  const verifyCredential = async () => ({ verified: true });
  const createRouter = () => Object.freeze({ kind: "router" });
  const deps = realDeps({ verifyCredential, createRouter });
  configureMovieMentorJourneyRecoveryBootMount({ app, ...deps });

  expectConflict(() =>
    configureMovieMentorJourneyRecoveryBootMount({
      app,
      ...deps,
      verifyCredential: null,
    }),
  );
  expectConflict(() =>
    configureMovieMentorJourneyRecoveryBootMount({
      app,
      ...deps,
      verifyCredential: async () => ({ verified: true }),
    }),
  );
  expectConflict(() =>
    configureMovieMentorJourneyRecoveryBootMount({
      app,
      ...deps,
      expectedIssuer: "https://drifted-issuer.example.test",
    }),
  );
  expectConflict(() =>
    configureMovieMentorJourneyRecoveryBootMount({
      app,
      ...deps,
      expectedAudience: "different-audience",
    }),
  );
  expectConflict(() =>
    configureMovieMentorJourneyRecoveryBootMount({
      app,
      ...deps,
      basePath: "/api/other-recovery",
    }),
  );
  expectConflict(() =>
    configureMovieMentorJourneyRecoveryBootMount({
      app,
      ...deps,
      createRouter: () => Object.freeze({ kind: "replacement-router" }),
    }),
  );

  assert.equal(app.mounts.length, 1, "drift must never create a second mount");
}

// Mutable caller configuration cannot rewrite the snapshot after activation.
{
  const app = fakeApp();
  const verifyCredential = async () => ({ verified: true });
  const createRouter = () => Object.freeze({ kind: "router" });
  const config = {
    app,
    verifyCredential,
    expectedIssuer: "https://issuer.example.test",
    expectedAudience: "iband.movie-mentor",
    basePath: "/api/movie-mentor-recovery",
    createRouter,
  };

  configureMovieMentorJourneyRecoveryBootMount(config);
  config.expectedIssuer = "https://mutated.example.test";
  expectConflict(() => configureMovieMentorJourneyRecoveryBootMount(config));
  assert.equal(app.mounts.length, 1);
}

// Router construction failure does not leave a false activation latch.
{
  const app = fakeApp();
  const verifyCredential = async () => ({ verified: true });
  const badRouterFactory = () => {
    throw Object.assign(new Error("synthetic router construction failure"), {
      code: "SYNTHETIC_ROUTER_FACTORY_FAILURE",
    });
  };

  assert.throws(() =>
    configureMovieMentorJourneyRecoveryBootMount({
      app,
      ...realDeps({ verifyCredential, createRouter: badRouterFactory }),
    }),
  );
  assert.equal(app.mounts.length, 0);

  const good = configureMovieMentorJourneyRecoveryBootMount({
    app,
    ...realDeps({ verifyCredential }),
  });
  assert.equal(good.mounted, true);
  assert.equal(app.mounts.length, 1);
}

// app.use failure also cannot record a mount that never completed.
{
  const app = fakeApp({ throwOnUse: true });
  const deps = realDeps();
  assert.throws(() => configureMovieMentorJourneyRecoveryBootMount({ app, ...deps }));
  assert.equal(app.mounts.length, 0);

  // A different healthy app remains independently activatable.
  const healthyApp = fakeApp();
  const healthy = configureMovieMentorJourneyRecoveryBootMount({
    app: healthyApp,
    ...deps,
  });
  assert.equal(healthy.mounted, true);
  assert.equal(healthyApp.mounts.length, 1);
}

console.log("✓ partial configuration never latches a false activation");
console.log("✓ exact boot retry is idempotent and cannot double-mount");
console.log("✓ verifier replacement and auth-policy drift are rejected after mount");
console.log("✓ path/factory drift cannot create a second recovery surface");
console.log("✓ mutable caller config cannot rewrite the captured activation snapshot");
console.log("✓ router/app.use failure cannot create phantom mounted state");
console.log("3C.5E.4D torture: GREEN");
