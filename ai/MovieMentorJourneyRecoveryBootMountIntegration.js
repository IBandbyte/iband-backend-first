import { mountMovieMentorJourneyRecoveryRouteIfReady } from "./MovieMentorJourneyRecoveryRouteMountDependencyGate.js";
import { createMovieMentorJourneyRecoveryExpressRouter } from "./MovieMentorJourneyRecoveryExpressRouterFactory.js";

const MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_MOUNT_INTEGRATION_VERSION = "1.2.0";
const DEFAULT_BASE_PATH = "/api/movie-mentor-recovery";
const ACTIVATIONS = new WeakMap();

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function sameActivation(existing, requested) {
  return (
    existing.verifyCredential === requested.verifyCredential &&
    existing.expectedIssuer === requested.expectedIssuer &&
    existing.expectedAudience === requested.expectedAudience &&
    existing.basePath === requested.basePath &&
    existing.createRouter === requested.createRouter &&
    existing.mountGate === requested.mountGate
  );
}

function alreadyMounted(existing) {
  return Object.freeze({
    mountable: true,
    mounted: true,
    idempotent: true,
    reason: "already-mounted-with-identical-activation",
    basePath: existing.basePath,
    version: MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_MOUNT_INTEGRATION_VERSION,
  });
}

function uncertainMount(existing) {
  const error = new Error(
    "Recovery route mount outcome is uncertain; refusing to remount without process restart or external reality proof."
  );
  error.code = "MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_MOUNT_OUTCOME_UNCERTAIN";
  error.basePath = existing.basePath;
  throw error;
}

/**
 * 3C.5E.4C/4D/4E — Production Mount Wiring + Activation Integrity +
 * Ambiguous Mount Outcome Containment
 *
 * 4C binds the certified 4A dependency gate to the certified 4B Express router
 * factory and the application-owned mount point.
 *
 * 4D makes successful activation monotonic within one application process.
 *
 * 4E closes the app.use lost-ack / partial-mount abyss. Once app.use has been
 * invoked, a thrown error cannot prove that Express routing reality remained
 * unchanged. The integration therefore records an UNCERTAIN activation before
 * rethrowing. No retry on that same app instance may call app.use again.
 *
 * Constitutional law:
 *   An uncertain mount outcome is not permission to remount.
 *
 * The module still does not invent authentication. With no real verifier,
 * boot remains successful and recovery remains unmounted.
 */
function configureMovieMentorJourneyRecoveryBootMount({
  app = null,
  verifyCredential = null,
  expectedIssuer = null,
  expectedAudience = null,
  basePath = DEFAULT_BASE_PATH,
  createRouter = createMovieMentorJourneyRecoveryExpressRouter,
  mountGate = mountMovieMentorJourneyRecoveryRouteIfReady,
} = {}) {
  if (!app || typeof app.use !== "function") {
    fail(
      "MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_APP_REQUIRED",
      "Recovery boot integration requires an Express-compatible application."
    );
  }

  if (typeof mountGate !== "function") {
    fail(
      "MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_MOUNT_GATE_REQUIRED",
      "Recovery boot integration requires the certified mount dependency gate."
    );
  }

  const requested = Object.freeze({
    verifyCredential,
    expectedIssuer: cleanString(expectedIssuer),
    expectedAudience: cleanString(expectedAudience),
    basePath: cleanString(basePath) || DEFAULT_BASE_PATH,
    createRouter,
    mountGate,
  });

  const existing = ACTIVATIONS.get(app);
  if (existing) {
    if (!sameActivation(existing, requested)) {
      fail(
        "MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_ACTIVATION_CONFLICT",
        "Recovery route activation state exists with different dependencies."
      );
    }

    if (existing.state === "mounted") {
      return alreadyMounted(existing);
    }

    if (existing.state === "uncertain") {
      uncertainMount(existing);
    }
  }

  let mountAttempted = false;

  let result;
  try {
    result = mountGate({
      verifyCredential: requested.verifyCredential,
      expectedIssuer: requested.expectedIssuer || null,
      expectedAudience: requested.expectedAudience || null,
      createRouter: requested.createRouter,
      mountRouter: (router) => {
        mountAttempted = true;
        return app.use(requested.basePath, router);
      },
    });
  } catch (error) {
    if (mountAttempted) {
      ACTIVATIONS.set(
        app,
        Object.freeze({
          ...requested,
          state: "uncertain",
        })
      );
    }
    throw error;
  }

  if (result?.mounted === true) {
    ACTIVATIONS.set(
      app,
      Object.freeze({
        ...requested,
        state: "mounted",
      })
    );
  }

  return Object.freeze({
    ...result,
    idempotent: false,
    basePath: requested.basePath,
    version: MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_MOUNT_INTEGRATION_VERSION,
  });
}

export {
  DEFAULT_BASE_PATH as MOVIE_MENTOR_JOURNEY_RECOVERY_DEFAULT_BASE_PATH,
  MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_MOUNT_INTEGRATION_VERSION,
  configureMovieMentorJourneyRecoveryBootMount,
};

export default configureMovieMentorJourneyRecoveryBootMount;
