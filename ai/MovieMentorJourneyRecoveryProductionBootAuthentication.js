import {
  createMovieMentorJourneyRecoveryProductionAuthenticationComposition,
  getMovieMentorJourneyRecoveryProductionAuthenticationCompositionStatus,
} from "./MovieMentorJourneyRecoveryProductionAuthenticationComposition.js";

const VERSION = "1.0.0";
const DOMAIN = "iband.movie-mentor.journey-recovery-production-boot-authentication";

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
    ready: false,
    reason,
    provider: "clerk",
    verifyCredential: null,
    expectedIssuer: null,
    expectedAudience: null,
    authorizedParties: freeze([]),
    bootWired: true,
    ...extras,
  });
}

function validateReadyComposition(composition) {
  if (
    !composition ||
    composition.ready !== true ||
    typeof composition.verifyCredential !== "function" ||
    !text(composition.expectedIssuer) ||
    !text(composition.expectedAudience) ||
    composition.provider !== "clerk" ||
    !Array.isArray(composition.authorizedParties) ||
    composition.authorizedParties.length === 0
  ) {
    fail(
      "MOVIE_MENTOR_RECOVERY_PRODUCTION_BOOT_AUTHENTICATION_COMPOSITION_INVALID",
      "Certified production authentication composition did not expose complete boot authentication authority."
    );
  }
}

function createMovieMentorJourneyRecoveryProductionBootAuthentication({
  env = process.env,
  createComposition = createMovieMentorJourneyRecoveryProductionAuthenticationComposition,
  getCompositionStatus = getMovieMentorJourneyRecoveryProductionAuthenticationCompositionStatus,
} = {}) {
  if (typeof createComposition !== "function" || typeof getCompositionStatus !== "function") {
    fail(
      "MOVIE_MENTOR_RECOVERY_PRODUCTION_BOOT_AUTHENTICATION_COMPOSITION_REQUIRED",
      "Production boot authentication requires the certified authentication composition factory and status inspector."
    );
  }

  const compositionStatus = getCompositionStatus({ env });

  if (!compositionStatus?.ready || compositionStatus?.configured !== true) {
    return closed("production-authentication-composition-not-ready", {
      compositionStatus: compositionStatus || null,
    });
  }

  const composition = createComposition({ env });
  validateReadyComposition(composition);

  return freeze({
    version: VERSION,
    domain: DOMAIN,
    ready: true,
    reason: "certified-production-authentication-composition-wired-for-boot",
    provider: "clerk",
    verifyCredential: composition.verifyCredential,
    expectedIssuer: text(composition.expectedIssuer),
    expectedAudience: text(composition.expectedAudience),
    authorizedParties: freeze([...composition.authorizedParties]),
    compositionVersion: text(composition.version) || null,
    compositionDomain: text(composition.domain) || null,
    compositionStatus,
    bootWired: true,
  });
}

function getMovieMentorJourneyRecoveryProductionBootAuthenticationStatus({
  env = process.env,
  getCompositionStatus = getMovieMentorJourneyRecoveryProductionAuthenticationCompositionStatus,
} = {}) {
  if (typeof getCompositionStatus !== "function") {
    fail(
      "MOVIE_MENTOR_RECOVERY_PRODUCTION_BOOT_AUTHENTICATION_STATUS_REQUIRED",
      "Production boot authentication status requires the certified authentication composition status inspector."
    );
  }

  const compositionStatus = getCompositionStatus({ env });
  const ready = Boolean(compositionStatus?.ready && compositionStatus?.configured === true);

  return freeze({
    version: VERSION,
    domain: DOMAIN,
    ready,
    provider: "clerk",
    compositionReady: ready,
    bootWired: true,
  });
}

export {
  VERSION as MOVIE_MENTOR_JOURNEY_RECOVERY_PRODUCTION_BOOT_AUTHENTICATION_VERSION,
  DOMAIN as MOVIE_MENTOR_JOURNEY_RECOVERY_PRODUCTION_BOOT_AUTHENTICATION_DOMAIN,
  createMovieMentorJourneyRecoveryProductionBootAuthentication,
  getMovieMentorJourneyRecoveryProductionBootAuthenticationStatus,
};

export default createMovieMentorJourneyRecoveryProductionBootAuthentication;
