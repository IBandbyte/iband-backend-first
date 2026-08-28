const MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHENTICATION_CONFIGURATION_AUTHORITY_VERSION = "1.0.0";
const MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHENTICATION_CONFIGURATION_AUTHORITY_DOMAIN =
  "iband.movie-mentor.journey-recovery-authentication-configuration-authority";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function isWildcardTrust(value) {
  const normalized = cleanString(value).toLowerCase();
  return normalized === "*" || normalized === "all" || normalized === "any" || normalized === "everyone";
}

function createMovieMentorJourneyRecoveryAuthenticationConfigurationAuthority({
  verifyCredential = null,
  expectedIssuer = null,
  expectedAudience = null,
} = {}) {
  const issuer = cleanString(expectedIssuer);
  const audience = cleanString(expectedAudience);
  const verifierConfigured = typeof verifyCredential === "function";
  const issuerConfigured = Boolean(issuer);
  const audienceConfigured = Boolean(audience);
  const configuredCount = [verifierConfigured, issuerConfigured, audienceConfigured].filter(Boolean).length;

  if (configuredCount === 0) {
    return Object.freeze({
      version: MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHENTICATION_CONFIGURATION_AUTHORITY_VERSION,
      domain: MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHENTICATION_CONFIGURATION_AUTHORITY_DOMAIN,
      ready: false,
      reason: "authentication-unconfigured",
      verifyCredential: null,
      expectedIssuer: null,
      expectedAudience: null,
    });
  }

  if (configuredCount !== 3) {
    return Object.freeze({
      version: MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHENTICATION_CONFIGURATION_AUTHORITY_VERSION,
      domain: MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHENTICATION_CONFIGURATION_AUTHORITY_DOMAIN,
      ready: false,
      reason: "authentication-partially-configured",
      verifyCredential: null,
      expectedIssuer: null,
      expectedAudience: null,
    });
  }

  if (isWildcardTrust(issuer)) {
    fail(
      "MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHENTICATION_ISSUER_WILDCARD_FORBIDDEN",
      "Journey recovery authentication forbids wildcard issuer trust."
    );
  }

  if (isWildcardTrust(audience)) {
    fail(
      "MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHENTICATION_AUDIENCE_WILDCARD_FORBIDDEN",
      "Journey recovery authentication forbids wildcard audience trust."
    );
  }

  return Object.freeze({
    version: MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHENTICATION_CONFIGURATION_AUTHORITY_VERSION,
    domain: MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHENTICATION_CONFIGURATION_AUTHORITY_DOMAIN,
    ready: true,
    reason: "authentication-configuration-authoritative",
    verifyCredential,
    expectedIssuer: issuer,
    expectedAudience: audience,
  });
}

function getMovieMentorJourneyRecoveryAuthenticationConfigurationAuthorityStatus(configuration = null) {
  return Object.freeze({
    version: MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHENTICATION_CONFIGURATION_AUTHORITY_VERSION,
    domain: MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHENTICATION_CONFIGURATION_AUTHORITY_DOMAIN,
    ready: configuration?.ready === true,
    reason: cleanString(configuration?.reason) || "authentication-configuration-unavailable",
    verifierConfigured: typeof configuration?.verifyCredential === "function",
    issuerConfigured: Boolean(cleanString(configuration?.expectedIssuer)),
    audienceConfigured: Boolean(cleanString(configuration?.expectedAudience)),
    bootWired: false,
  });
}

export {
  MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHENTICATION_CONFIGURATION_AUTHORITY_VERSION,
  MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHENTICATION_CONFIGURATION_AUTHORITY_DOMAIN,
  createMovieMentorJourneyRecoveryAuthenticationConfigurationAuthority,
  getMovieMentorJourneyRecoveryAuthenticationConfigurationAuthorityStatus,
};

export default createMovieMentorJourneyRecoveryAuthenticationConfigurationAuthority;
