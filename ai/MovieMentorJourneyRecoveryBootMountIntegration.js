import { mountMovieMentorJourneyRecoveryRouteIfReady } from "./MovieMentorJourneyRecoveryRouteMountDependencyGate.js";
import { createMovieMentorJourneyRecoveryExpressRouter } from "./MovieMentorJourneyRecoveryExpressRouterFactory.js";

const MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_MOUNT_INTEGRATION_VERSION = "1.1.0";
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

/**
 * 3C.5E.4C/4D — Production Mount Wiring + Activation Integrity
 *
 * 4C binds the certified 4A dependency gate to the certified 4B Express router
 * factory and the application-owned mount point.
 *
 * 4D makes activation monotonic within one application process:
 * - failed/partial configuration never records an activation;
 * - the first successful mount snapshots the verifier identity, issuer,
 *   audience, base path, router factory and mount gate;
 * - an exact boot retry is idempotent and cannot double-mount;
 * - any later downgrade, verifier replacement, issuer/audience drift, path
 *   drift or factory/gate replacement is an activation conflict;
 * - router construction or app.use failure cannot leave a false activation.
 *
 * This module still does not invent a verifier. With no real verifier function,
 * boot remains successful and the recovery endpoint remains unmounted.
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
    if (sameActivation(existing, requested)) {
      return alreadyMounted(existing);
    }

    fail(
      "MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_ACTIVATION_CONFLICT",
      "Recovery route is already mounted with different activation dependencies."
    );
  }

  const result = mountGate({
    verifyCredential: requested.verifyCredential,
    expectedIssuer: requested.expectedIssuer || null,
    expectedAudience: requested.expectedAudience || null,
    createRouter: requested.createRouter,
    mountRouter: (router) => app.use(requested.basePath, router),
  });

  if (result?.mounted === true) {
    ACTIVATIONS.set(app, requested);
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
