const VERSION = "1.0.0";
const DOMAIN = "iband.movie-mentor.journey-recovery-production-exposure-authority";
const EXPOSURE_ENV = "MOVIE_MENTOR_RECOVERY_EXPOSURE_ENABLED";
const ENABLED_VALUE = "true";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

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
    authorized: false,
    reason,
    exposureEnabled: false,
    authenticationReady: false,
    activationReady: false,
    bootWired: false,
    ...extras,
  });
}

function validateBootAuthentication(bootAuthentication) {
  return Boolean(
    bootAuthentication &&
    bootAuthentication.ready === true &&
    bootAuthentication.bootWired === true &&
    typeof bootAuthentication.verifyCredential === "function" &&
    text(bootAuthentication.expectedIssuer) &&
    text(bootAuthentication.expectedAudience)
  );
}

function validateBootActivation(bootActivation) {
  return Boolean(
    bootActivation &&
    bootActivation.ready === true &&
    bootActivation.bootWired === true &&
    typeof bootActivation.activationAuthority === "function" &&
    typeof bootActivation.renewActivation === "function" &&
    typeof bootActivation.assertFence === "function" &&
    text(bootActivation.processInstanceId) &&
    text(bootActivation.deploymentId)
  );
}

function authorizeMovieMentorJourneyRecoveryProductionExposure({
  env = process.env,
  bootAuthentication = null,
  bootActivation = null,
} = {}) {
  const rawExposure = text(env?.[EXPOSURE_ENV]);
  const exposureEnabled = rawExposure === ENABLED_VALUE;
  const authenticationReady = validateBootAuthentication(bootAuthentication);
  const activationReady = validateBootActivation(bootActivation);

  if (!exposureEnabled) {
    return closed(
      rawExposure
        ? "production-recovery-exposure-not-explicitly-enabled"
        : "production-recovery-exposure-unconfigured",
      {
        exposureEnabled: false,
        authenticationReady,
        activationReady,
      }
    );
  }

  if (!authenticationReady) {
    return closed("production-recovery-boot-authentication-not-ready", {
      exposureEnabled: true,
      authenticationReady: false,
      activationReady,
    });
  }

  if (!activationReady) {
    return closed("production-recovery-boot-activation-not-ready", {
      exposureEnabled: true,
      authenticationReady: true,
      activationReady: false,
    });
  }

  return freeze({
    version: VERSION,
    domain: DOMAIN,
    authorized: true,
    reason: "production-recovery-exposure-authorized",
    exposureEnabled: true,
    authenticationReady: true,
    activationReady: true,
    bootWired: false,
  });
}

function getMovieMentorJourneyRecoveryProductionExposureAuthorityStatus({
  env = process.env,
} = {}) {
  const rawExposure = text(env?.[EXPOSURE_ENV]);

  return freeze({
    version: VERSION,
    domain: DOMAIN,
    configured: Boolean(rawExposure),
    enabled: rawExposure === ENABLED_VALUE,
    exposureEnv: EXPOSURE_ENV,
    requiredValue: ENABLED_VALUE,
    bootWired: false,
  });
}

export {
  VERSION as MOVIE_MENTOR_JOURNEY_RECOVERY_PRODUCTION_EXPOSURE_AUTHORITY_VERSION,
  DOMAIN as MOVIE_MENTOR_JOURNEY_RECOVERY_PRODUCTION_EXPOSURE_AUTHORITY_DOMAIN,
  EXPOSURE_ENV as MOVIE_MENTOR_JOURNEY_RECOVERY_PRODUCTION_EXPOSURE_ENV,
  ENABLED_VALUE as MOVIE_MENTOR_JOURNEY_RECOVERY_PRODUCTION_EXPOSURE_ENABLED_VALUE,
  authorizeMovieMentorJourneyRecoveryProductionExposure,
  getMovieMentorJourneyRecoveryProductionExposureAuthorityStatus,
};

export default authorizeMovieMentorJourneyRecoveryProductionExposure;
