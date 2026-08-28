import { configureMovieMentorJourneyRecoveryBootMount } from "./MovieMentorJourneyRecoveryBootMountIntegration.js";
import { createMovieMentorJourneyRecoveryProductionBootActivation } from "./MovieMentorJourneyRecoveryProductionBootActivation.js";
import { createMovieMentorJourneyRecoveryProductionBootAuthentication } from "./MovieMentorJourneyRecoveryProductionBootAuthentication.js";
import { authorizeMovieMentorJourneyRecoveryProductionExposure } from "./MovieMentorJourneyRecoveryProductionExposureAuthority.js";

const VERSION = "1.0.0";
const DOMAIN = "iband.movie-mentor.journey-recovery-production-boot-assembly";
const DEFAULT_BASE_PATH = "/api/movie-mentor-recovery";

function freeze(value) {
  return Object.freeze(value);
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function closed(reason, extras = {}) {
  return freeze({
    version: VERSION,
    domain: DOMAIN,
    ready: false,
    exposureAuthorized: false,
    mounted: false,
    mountable: false,
    reason,
    basePath: DEFAULT_BASE_PATH,
    ...extras,
  });
}

/**
 * 3C.5E.4H.6 — Final Production Boot Assembly & Recovery Exposure
 *
 * Constitutional law:
 *   Authority may permit exposure. Only the final boot assembly may enact it.
 *   Exposure authority never substitutes for the certified mount dependency gate.
 */
async function assembleMovieMentorJourneyRecoveryProductionBoot({
  app = null,
  env = process.env,
  createBootAuthentication = createMovieMentorJourneyRecoveryProductionBootAuthentication,
  createBootActivation = createMovieMentorJourneyRecoveryProductionBootActivation,
  authorizeExposure = authorizeMovieMentorJourneyRecoveryProductionExposure,
  configureBootMount = configureMovieMentorJourneyRecoveryBootMount,
} = {}) {
  if (!app || typeof app.use !== "function") {
    fail(
      "MOVIE_MENTOR_RECOVERY_PRODUCTION_BOOT_ASSEMBLY_APP_REQUIRED",
      "Final production recovery boot assembly requires an Express-compatible application."
    );
  }

  if (
    typeof createBootAuthentication !== "function" ||
    typeof createBootActivation !== "function" ||
    typeof authorizeExposure !== "function" ||
    typeof configureBootMount !== "function"
  ) {
    fail(
      "MOVIE_MENTOR_RECOVERY_PRODUCTION_BOOT_ASSEMBLY_DEPENDENCY_REQUIRED",
      "Final production recovery boot assembly requires the certified boot authentication, boot activation, exposure authority, and mount integration dependencies."
    );
  }

  const bootAuthentication = createBootAuthentication({ env });
  const bootActivation = createBootActivation({ env });
  const exposure = authorizeExposure({
    env,
    bootAuthentication,
    bootActivation,
  });

  if (!exposure?.authorized) {
    return closed(exposure?.reason || "production-recovery-exposure-not-authorized", {
      exposure: exposure || null,
    });
  }

  const mount = await configureBootMount({
    app,
    verifyCredential: bootAuthentication?.verifyCredential ?? null,
    expectedIssuer: bootAuthentication?.expectedIssuer ?? null,
    expectedAudience: bootAuthentication?.expectedAudience ?? null,
    activationAuthority: bootActivation?.activationAuthority ?? null,
    renewActivation: bootActivation?.renewActivation ?? null,
    assertFence: bootActivation?.assertFence ?? null,
    processInstanceId: bootActivation?.processInstanceId ?? null,
    deploymentId: bootActivation?.deploymentId ?? null,
  });

  return freeze({
    ...mount,
    version: VERSION,
    domain: DOMAIN,
    ready: mount?.mounted === true,
    exposureAuthorized: true,
    exposureReason: exposure.reason,
  });
}

export {
  VERSION as MOVIE_MENTOR_JOURNEY_RECOVERY_PRODUCTION_BOOT_ASSEMBLY_VERSION,
  DOMAIN as MOVIE_MENTOR_JOURNEY_RECOVERY_PRODUCTION_BOOT_ASSEMBLY_DOMAIN,
  assembleMovieMentorJourneyRecoveryProductionBoot,
};

export default assembleMovieMentorJourneyRecoveryProductionBoot;
