import assert from "node:assert/strict";

import {
  configureMovieMentorJourneyRecoveryBootMount,
} from "../ai/MovieMentorJourneyRecoveryBootMountIntegration.js";

function deps(overrides = {}) {
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

function expectUncertain(fn) {
  assert.throws(
    fn,
    (error) =>
      error?.code === "MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_MOUNT_OUTCOME_UNCERTAIN",
  );
}

function expectConflict(fn) {
  assert.throws(
    fn,
    (error) =>
      error?.code === "MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_ACTIVATION_CONFLICT",
  );
}

console.log("3C.5E.4E — recovery partial-mount / lost-ack torture");

// Universe A: app.use mutates routing reality, then throws. First call is
// ambiguous; exact retry MUST NOT call app.use again.
{
  let useCalls = 0;
  const liveMounts = [];
  const app = {
    use(path, router) {
      useCalls += 1;
      liveMounts.push({ path, router });
      throw Object.assign(new Error("ACK lost after mount committed"), {
        code: "SYNTHETIC_MOUNT_ACK_LOSS",
      });
    },
  };
  const config = deps();

  assert.throws(
    () => configureMovieMentorJourneyRecoveryBootMount({ app, ...config }),
    (error) => error?.code === "SYNTHETIC_MOUNT_ACK_LOSS",
  );
  assert.equal(useCalls, 1);
  assert.equal(liveMounts.length, 1, "first router may already be live");

  expectUncertain(() =>
    configureMovieMentorJourneyRecoveryBootMount({ app, ...config }),
  );
  expectUncertain(() =>
    configureMovieMentorJourneyRecoveryBootMount({ app, ...config }),
  );
  assert.equal(useCalls, 1, "uncertain retry must never remount");
  assert.equal(liveMounts.length, 1);

  expectConflict(() =>
    configureMovieMentorJourneyRecoveryBootMount({
      app,
      ...config,
      expectedIssuer: "https://zorg.example.test",
    }),
  );
  expectConflict(() =>
    configureMovieMentorJourneyRecoveryBootMount({
      app,
      ...config,
      verifyCredential: async () => ({ verified: true }),
    }),
  );
  expectConflict(() =>
    configureMovieMentorJourneyRecoveryBootMount({
      app,
      ...config,
      basePath: "/api/second-recovery",
    }),
  );
  assert.equal(useCalls, 1);
}

// Universe B: app.use throws before observable mutation. We still cannot know
// that from the integration boundary, so retry remains prohibited.
{
  let useCalls = 0;
  const app = {
    use() {
      useCalls += 1;
      throw Object.assign(new Error("pre-commit looking failure"), {
        code: "SYNTHETIC_PRECOMMIT_LOOKING_FAILURE",
      });
    },
  };
  const config = deps();

  assert.throws(() => configureMovieMentorJourneyRecoveryBootMount({ app, ...config }));
  assert.equal(useCalls, 1);
  expectUncertain(() => configureMovieMentorJourneyRecoveryBootMount({ app, ...config }));
  assert.equal(useCalls, 1);
}

// Universe C: failure before app.use (router construction) remains safe to
// retry because no mount attempt crossed the application boundary.
{
  let useCalls = 0;
  const app = {
    use() {
      useCalls += 1;
    },
  };
  const verifyCredential = async () => ({ verified: true });
  const badFactory = () => {
    throw Object.assign(new Error("router failed before mount"), {
      code: "SYNTHETIC_ROUTER_BUILD_FAILURE",
    });
  };

  assert.throws(() =>
    configureMovieMentorJourneyRecoveryBootMount({
      app,
      ...deps({ verifyCredential, createRouter: badFactory }),
    }),
  );
  assert.equal(useCalls, 0);

  const goodFactory = () => Object.freeze({ kind: "good-router" });
  const result = configureMovieMentorJourneyRecoveryBootMount({
    app,
    ...deps({ verifyCredential, createRouter: goodFactory }),
  });
  assert.equal(result.mounted, true);
  assert.equal(useCalls, 1);
}

// Universe D: uncertainty is app-instance scoped; it cannot poison a fresh
// process/application instance, which is the safe recovery boundary.
{
  const config = deps();
  const ambiguousApp = {
    use() {
      throw new Error("ambiguous old process");
    },
  };
  assert.throws(() =>
    configureMovieMentorJourneyRecoveryBootMount({ app: ambiguousApp, ...config }),
  );

  let freshUses = 0;
  const freshApp = {
    use() {
      freshUses += 1;
    },
  };
  const fresh = configureMovieMentorJourneyRecoveryBootMount({
    app: freshApp,
    ...config,
  });
  assert.equal(fresh.mounted, true);
  assert.equal(freshUses, 1);
}

console.log("✓ app.use ACK loss cannot trigger a second blind mount");
console.log("✓ exact uncertain retry is terminal for the current app instance");
console.log("✓ dependency drift during uncertainty is an activation conflict");
console.log("✓ pre-app.use failures remain safely retryable");
console.log("✓ fresh app/process instance remains independently activatable");
console.log("LAW: uncertainty is not authorization to remount");
console.log("3C.5E.4E torture: GREEN");
