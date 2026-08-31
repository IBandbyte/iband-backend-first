import {
  createMovieMentorJourneyRecoveryClerkCredentialVerifier,
  MOVIE_MENTOR_JOURNEY_RECOVERY_CLERK_CREDENTIAL_VERIFIER_VERSION,
  MOVIE_MENTOR_JOURNEY_RECOVERY_CLERK_CREDENTIAL_VERIFIER_DOMAIN,
} from "./MovieMentorJourneyRecoveryClerkCredentialVerifier.js";

const VERSION = "1.1.0";
const DOMAIN = "iband.movie-mentor.production-authentication-composition";
const ENV = Object.freeze({
  jwtKey: "MOVIE_MENTOR_CLERK_JWT_KEY",
  authorizedParties: "MOVIE_MENTOR_CLERK_AUTHORIZED_PARTIES_JSON",
  expectedIssuer: "MOVIE_MENTOR_CLERK_ISSUER",
  expectedAudience: "MOVIE_MENTOR_AUDIENCE",
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
    fail("MOVIE_MENTOR_PRODUCTION_AUTHORIZED_PARTIES_JSON_INVALID", "Movie Mentor production authorized parties must be valid JSON.");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    fail("MOVIE_MENTOR_PRODUCTION_AUTHORIZED_PARTIES_REQUIRED", "Movie Mentor production authentication requires a non-empty authorized parties array.");
  }
  return parsed;
}

function verifierCapabilityProven(verifier) {
  return Boolean(
    verifier &&
    typeof verifier.verifyCredential === "function" &&
    verifier.version === MOVIE_MENTOR_JOURNEY_RECOVERY_CLERK_CREDENTIAL_VERIFIER_VERSION &&
    verifier.domain === MOVIE_MENTOR_JOURNEY_RECOVERY_CLERK_CREDENTIAL_VERIFIER_DOMAIN &&
    verifier.provider === "clerk" &&
    verifier.algorithm === "RS256" &&
    verifier.networkMode === "pinned-public-key" &&
    Array.isArray(verifier.authorizedParties) &&
    verifier.authorizedParties.length > 0
  );
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
    verifierVersion: null,
    verifierDomain: null,
    verifierAlgorithm: null,
    verifierNetworkMode: null,
  });
}

function createMovieMentorProductionAuthenticationComposition({
  env = process.env,
  createVerifier = createMovieMentorJourneyRecoveryClerkCredentialVerifier,
} = {}) {
  if (typeof createVerifier !== "function") {
    fail("MOVIE_MENTOR_PRODUCTION_AUTHENTICATION_VERIFIER_FACTORY_REQUIRED", "Movie Mentor production authentication requires the certified Clerk verifier factory.");
  }

  const jwtKeyRaw = text(env?.[ENV.jwtKey]);
  const authorizedPartiesRaw = text(env?.[ENV.authorizedParties]);
  const expectedIssuer = text(env?.[ENV.expectedIssuer]);
  const expectedAudience = text(env?.[ENV.expectedAudience]);
  const configured = [jwtKeyRaw, authorizedPartiesRaw, expectedIssuer, expectedAudience].map(Boolean);
  const configuredCount = configured.filter(Boolean).length;

  if (configuredCount === 0) return closed("production-authentication-unconfigured");
  if (configuredCount !== configured.length) return closed("production-authentication-partially-configured");

  const verifier = createVerifier({
    jwtKey: normalizePem(jwtKeyRaw),
    authorizedParties: parseAuthorizedParties(authorizedPartiesRaw),
  });

  if (!verifierCapabilityProven(verifier)) {
    fail(
      "MOVIE_MENTOR_PRODUCTION_AUTHENTICATION_VERIFIER_CAPABILITY_NOT_PROVEN",
      "Production authentication requires the Clerk verifier to own the exact pinned-key RS256 capability contract."
    );
  }

  return freeze({
    version: VERSION,
    domain: DOMAIN,
    ready: true,
    reason: "production-authentication-composed",
    provider: "clerk",
    verifyCredential: verifier.verifyCredential,
    expectedIssuer,
    expectedAudience,
    authorizedParties: freeze([...verifier.authorizedParties]),
    verifierVersion: verifier.version,
    verifierDomain: verifier.domain,
    verifierAlgorithm: verifier.algorithm,
    verifierNetworkMode: verifier.networkMode,
  });
}

function getMovieMentorProductionAuthenticationCompositionStatus({ env = process.env } = {}) {
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
    verifierDomain: MOVIE_MENTOR_JOURNEY_RECOVERY_CLERK_CREDENTIAL_VERIFIER_DOMAIN,
    verifierVersion: MOVIE_MENTOR_JOURNEY_RECOVERY_CLERK_CREDENTIAL_VERIFIER_VERSION,
    verifierAlgorithm: "RS256",
    verifierNetworkMode: "pinned-public-key",
    verifierCapabilityRequired: true,
    environment: ENV,
  });
}

export {
  VERSION as MOVIE_MENTOR_PRODUCTION_AUTHENTICATION_COMPOSITION_VERSION,
  DOMAIN as MOVIE_MENTOR_PRODUCTION_AUTHENTICATION_COMPOSITION_DOMAIN,
  ENV as MOVIE_MENTOR_PRODUCTION_AUTHENTICATION_ENV,
  createMovieMentorProductionAuthenticationComposition,
  getMovieMentorProductionAuthenticationCompositionStatus,
  parseAuthorizedParties,
};

export default createMovieMentorProductionAuthenticationComposition;
