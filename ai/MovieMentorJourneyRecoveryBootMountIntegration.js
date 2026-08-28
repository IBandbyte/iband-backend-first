import {
  inspectMovieMentorJourneyRecoveryRouteMountDependencies,
  mountMovieMentorJourneyRecoveryRouteIfReady,
} from "./MovieMentorJourneyRecoveryRouteMountDependencyGate.js";
import { createMovieMentorJourneyRecoveryExpressRouter } from "./MovieMentorJourneyRecoveryExpressRouterFactory.js";
import { authorizeMovieMentorJourneyRecoveryProcessActivation } from "./MovieMentorJourneyRecoveryCrossProcessActivationBoundary.js";

const MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_MOUNT_INTEGRATION_VERSION = "1.3.0";
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
    existing.mountGate === requested.mountGate &&
    existing.activationBoundary === requested.activationBoundary &&
    existing.activationAuthority === requested.activationAuthority &&
    existing.processInstanceId === requested.processInstanceId &&
    existing.deploymentId === requested.deploymentId
  );
}

function alreadyMounted(existing) {
  return Object.freeze({
    mountable: true,
    mounted: true,
    idempotent: true,
    reason: "already-mounted-with-identical-activation",
    basePath: existing.basePath,
    processInstanceId: existing.processInstanceId,
    deploymentId: existing.deploymentId,
    activationEpoch: existing.activationEpoch,
    activationReference: existing.activationReference,
    version: MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_MOUNT_INTEGRATION_VERSION,
  });
}

function uncertainMount(existing) {
  const error = new Error(
    "Recovery route mount outcome is uncertain; refusing to remount without external service-level reality proof."
  );
  error.code = "MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_MOUNT_OUTCOME_UNCERTAIN";
  error.basePath = existing.basePath;
  throw error;
}

/**
 * 3C.5E.4C/4D/4E/4F — Production Recovery Route Activation
 *
 * 4C: fail-closed production boot wiring.
 * 4D: monotonic in-process activation configuration.
 * 4E: ambiguous app.use outcomes cannot authorize blind remount.
 * 4F: a fresh process cannot infer service-level exposure reality from empty
 *     process-local memory. A mountable process must obtain externally supplied,
 *     process-bound activation authority before app.use is allowed.
 *
 * Constitutional law:
 *   Process-local absence is not proof of service-level absence.
 *   Restart is not authority to remount.
 *   Cross-process activation requires external reality evidence.
 */
async function configureMovieMentorJourneyRecoveryBootMount({
  app = null,
  verifyCredential = null,
  expectedIssuer = null,
  expectedAudience = null,
  basePath = DEFAULT_BASE_PATH,
  createRouter = createMovieMentorJourneyRecoveryExpressRouter,
  mountGate = mountMovieMentorJourneyRecoveryRouteIfReady,
  inspectMountDependencies = inspectMovieMentorJourneyRecoveryRouteMountDependencies,
  activationBoundary = authorizeMovieMentorJourneyRecoveryProcessActivation,
  activationAuthority = null,
  processInstanceId = null,
  deploymentId = null,
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
  if (typeof inspectMountDependencies !== "function") {
    fail(
      "MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_DEPENDENCY_INSPECTOR_REQUIRED",
      "Recovery boot integration requires the certified mount dependency inspector."
    );
  }
  if (typeof activationBoundary !== "function") {
    fail(
      "MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_ACTIVATION_BOUNDARY_REQUIRED",
      "Recovery boot integration requires the cross-process activation boundary."
    );
  }

  const requested = Object.freeze({
    verifyCredential,
    expectedIssuer: cleanString(expectedIssuer),
    expectedAudience: cleanString(expectedAudience),
    basePath: cleanString(basePath) || DEFAULT_BASE_PATH,
    createRouter,
    mountGate,
    activationBoundary,
    activationAuthority,
    processInstanceId: cleanString(processInstanceId),
    deploymentId: cleanString(deploymentId),
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

  const dependencyInspection = inspectMountDependencies({
    verifyCredential: requested.verifyCredential,
    expectedIssuer: requested.expectedIssuer || null,
    expectedAudience: requested.expectedAudience || null,
    createRouter: requested.createRouter,
    mountRouter: () => {},
  });

  if (!dependencyInspection?.mountable) {
    return Object.freeze({
      ...dependencyInspection,
      idempotent: false,
      basePath: requested.basePath,
      version: MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_MOUNT_INTEGRATION_VERSION,
    });
  }

  const activation = await requested.activationBoundary({
    processInstanceId: requested.processInstanceId || null,
    deploymentId: requested.deploymentId || null,
    basePath: requested.basePath,
    expectedIssuer: requested.expectedIssuer,
    expectedAudience: requested.expectedAudience,
    authorizeActivation: requested.activationAuthority,
  });

  if (!activation?.authorized) {
    return Object.freeze({
      mountable: false,
      mounted: false,
      idempotent: false,
      reason: activation?.reason || "cross-process-activation-not-authorized",
      basePath: requested.basePath,
      version: MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_MOUNT_INTEGRATION_VERSION,
    });
  }

  const authorizedRequest = Object.freeze({
    ...requested,
    activationEpoch: activation.activationEpoch,
    activationReference: activation.activationReference,
  });

  let mountAttempted = false;
  let result;
  try {
    result = mountGate({
      verifyCredential: requested.verifyCredential,
      expectedIssuer: requested.expectedIssuer,
      expectedAudience: requested.expectedAudience,
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
          ...authorizedRequest,
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
        ...authorizedRequest,
        state: "mounted",
      })
    );
  }

  return Object.freeze({
    ...result,
    idempotent: false,
    basePath: requested.basePath,
    processInstanceId: requested.processInstanceId,
    deploymentId: requested.deploymentId,
    activationEpoch: activation.activationEpoch,
    activationReference: activation.activationReference,
    version: MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_MOUNT_INTEGRATION_VERSION,
  });
}

export {
  DEFAULT_BASE_PATH as MOVIE_MENTOR_JOURNEY_RECOVERY_DEFAULT_BASE_PATH,
  MOVIE_MENTOR_JOURNEY_RECOVERY_BOOT_MOUNT_INTEGRATION_VERSION,
  configureMovieMentorJourneyRecoveryBootMount,
};

export default configureMovieMentorJourneyRecoveryBootMount;
