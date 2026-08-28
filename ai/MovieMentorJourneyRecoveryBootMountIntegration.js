import { mountMovieMentorJourneyRecoveryRouteIfReady } from "./MovieMentorJourneyRecoveryRouteMountDependencyGate.js";
import { createMovieMentorJourneyRecoveryExpressRouter } from "./MovieMentorJourneyRecoveryExpressRouterFactory.js";

const MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_MOUNT_INTEGRATION_VERSION = "1.0.0";
const DEFAULT_BASE_PATH = "/api/movie-mentor-recovery";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

/**
 * 3C.5E.4C — Production Mount Wiring / Boot-Time Fail-Closed Integration
 *
 * This module binds the certified 4A dependency gate to the certified 4B
 * Express router factory and an application-owned app.use mount point.
 *
 * It does not invent a verifier. If no real verifier function is supplied,
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

  const mountPath = cleanString(basePath) || DEFAULT_BASE_PATH;

  const result = mountGate({
    verifyCredential,
    expectedIssuer,
    expectedAudience,
    createRouter,
    mountRouter: (router) => app.use(mountPath, router),
  });

  return Object.freeze({
    ...result,
    basePath: mountPath,
    version: MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_MOUNT_INTEGRATION_VERSION,
  });
}

export {
  DEFAULT_BASE_PATH as MOVIE_MENTOR_JOURNEY_RECOVERY_DEFAULT_BASE_PATH,
  MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_MOUNT_INTEGRATION_VERSION,
  configureMovieMentorJourneyRecoveryBootMount,
};

export default configureMovieMentorJourneyRecoveryBootMount;
