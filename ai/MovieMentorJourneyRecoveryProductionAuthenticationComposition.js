import {
  createMovieMentorJourneyRecoveryAuthenticationConfigurationAuthority,
} from "./MovieMentorJourneyRecoveryAuthenticationConfigurationAuthority.js";
import {
  createMovieMentorJourneyRecoveryClerkCredentialVerifier,
} from "./MovieMentorJourneyRecoveryClerkCredentialVerifier.js";

const VERSION = "1.0.0";
const DOMAIN = "iband.movie-mentor.journey-recovery-production-authentication-composition";

const ENV = Object.freeze({
  jwtKey: "MOVIE_MENTOR_RECOVERY_CLERK_JWT_KEY",
  authorizedParties: "MOVIE_MENTOR_RECOVERY_CLERK_AUTHORIZED_PARTIES_JSON",
  expectedIssuer: "MOVIE_MENTOR_RECOVERY_CLERK_ISSUER",
  expectedAudience: "MOVIE_MENTOR_RECOVERY_AUDIENCE",
});

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

function closed(reason) {
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
    bootWired: false,
  });
}

function normalizePem(value) {
  return text(value).replace(/\\n/g, "\n");
}

function parseAuthorizedParties(value) {
  const raw = text(value);
  if (!raw) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail(
      "MOVIE_MENTOR_RECOVERY_PRODUCTION_AUTHENTICATION_AUTHORIZED_PARTIES_JSON_INVALID",
      "Production recovery authentication authorized parties must be valid JSON."
    );
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    fail(
      "MOVIE_MENTOR_RECOVERY_PRODUCTION_AUTHENTICATION_AUTHORIZED_PARTIES_REQUIRED",
      "Production recovery authentication requires a non-empty authorized parties array."
    );
  }

  return parsed;
}

function createMovieMentorJourneyRecoveryProductionAuthenticationComposition({
  env = process.env,
  createVerifier = createMovieMentorJourneyRecoveryClerkCredentialVerifier,
  createConfigurationAuthority = createMovieMentorJourneyRecoveryAuthenticationConfigurationAuthority,
} = {}) {
  if (typeof createVerifier !== "function" || typeof createConfigurationAuthority !== "function") {
    fail(
      "MOVIE_MENTOR_RECOVERY_PRODUCTION_AUTHENTICATION_FACTORIES_REQUIRED",
      "Production recovery authentication requires the certified verifier and configuration authority factories."
    );
  }

  const jwtKeyRaw = text(env?.[ENV.jwtKey]);
  const authorizedPartiesRaw = text(env?.[ENV.authorizedParties]);
  const expectedIssuer = text(env?.[ENV.expectedIssuer]);
  const expectedAudience = text(env?.[ENV.expectedAudience]);

  const configured = [jwtKeyRaw, authorizedPartiesRaw, expectedIssuer, expectedAudience].map(Boolean);
  const configuredCount = configured.filter(Boolean).length;

  if (configuredCount === 0) {
    return closed("production-authentication-unconfigured");
  }

  if (configuredCount !== configured.length) {
    return closed("production-authentication-partially-configured");
  }

  const authorizedParties = parseAuthorizedParties(authorizedPartiesRaw);
  const verifier = createVerifier({
    jwtKey: normalizePem(jwtKeyRaw),
    authorizedParties,
  });

  if (!verifier || typeof verifier.verifyCredential !== "function") {
    fail(
      "MOVIE_MENTOR_RECOVERY_PRODUCTION_AUTHENTICATION_VERIFIER_INVALID",
      "Certified Clerk verifier factory did not expose verifyCredential."
    );
  }

  const authority = createConfigurationAuthority({
    verifyCredential: verifier.verifyCredential,
    expectedIssuer,
    expectedAudience,
  });

  if (
    !authority ||
    authority.ready !== true ||
    typeof authority.verifyCredential !== "function" ||
    !text(authority.expectedIssuer) ||
    !text(authority.expectedAudience)
  ) {
    fail(
      "MOVIE_MENTOR_RECOVERY_PRODUCTION_AUTHENTICATION_AUTHORITY_INVALID",
      "Certified authentication configuration authority did not return complete authority."
    );
  }

  return freeze({
    version: VERSION,
    domain: DOMAIN,
    ready: true,
    reason: "production-authentication-composed",
    provider: "clerk",
    verifyCredential: authority.verifyCredential,
    expectedIssuer: authority.expectedIssuer,
    expectedAudience: authority.expectedAudience,
    authorizedParties: freeze([...(verifier.authorizedParties || [])]),
    verifierVersion: text(verifier.version) || null,
    verifierDomain: text(verifier.domain) || null,
    bootWired: false,
  });
}

function getMovieMentorJourneyRecoveryProductionAuthenticationCompositionStatus({ env = process.env } = {}) {
  const configured = [
    text(env?.[ENV.jwtKey]),
    text(env?.[ENV.authorizedParties]),
    text(env?.[ENV.expectedIssuer]),
    text(env?.[ENV.expectedAudience]),
  ].map(Boolean);
  const configuredCount = configured.filter(Boolean).length;

  return freeze({
    version: VERSION,
    domain: DOMAIN,
    ready: configuredCount === configured.length,
    configured: configuredCount === configured.length,
    partiallyConfigured: configuredCount > 0 && configuredCount < configured.length,
    provider: "clerk",
    bootWired: false,
    environment: ENV,
  });
}

export {
  VERSION as MOVIE_MENTOR_JOURNEY_RECOVERY_PRODUCTION_AUTHENTICATION_COMPOSITION_VERSION,
  DOMAIN as MOVIE_MENTOR_JOURNEY_RECOVERY_PRODUCTION_AUTHENTICATION_COMPOSITION_DOMAIN,
  ENV as MOVIE_MENTOR_JOURNEY_RECOVERY_PRODUCTION_AUTHENTICATION_ENV,
  createMovieMentorJourneyRecoveryProductionAuthenticationComposition,
  getMovieMentorJourneyRecoveryProductionAuthenticationCompositionStatus,
  parseAuthorizedParties,
};

export default createMovieMentorJourneyRecoveryProductionAuthenticationComposition;
