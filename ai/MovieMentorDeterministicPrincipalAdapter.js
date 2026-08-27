const MOVIE_MENTOR_DETERMINISTIC_PRINCIPAL_ADAPTER_VERSION = "1.0.0";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function fail(code, message, extras = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extras);
  throw error;
}

function readBearerCredential(request = {}) {
  const header = cleanString(
    request?.headers?.authorization ||
      request?.headers?.Authorization ||
      request?.authorization ||
      ""
  );

  if (!header) {
    fail(
      "MOVIE_MENTOR_AUTH_CREDENTIAL_REQUIRED",
      "Movie Mentor authentication requires an authorization credential."
    );
  }

  const match = /^Bearer\s+(.+)$/i.exec(header);
  const credential = cleanString(match?.[1]);
  if (!credential) {
    fail(
      "MOVIE_MENTOR_AUTH_BEARER_REQUIRED",
      "Movie Mentor authentication requires a Bearer credential."
    );
  }

  return credential;
}

function validateVerifiedEvidence(evidence = {}, { now = new Date() } = {}) {
  if (!evidence || evidence.verified !== true) {
    fail(
      "MOVIE_MENTOR_AUTH_NOT_VERIFIED",
      "Authentication verifier did not return verified evidence."
    );
  }

  const subject = cleanString(evidence.subject || evidence.sub);
  const issuer = cleanString(evidence.issuer || evidence.iss);
  const audience = cleanString(
    Array.isArray(evidence.audience || evidence.aud)
      ? (evidence.audience || evidence.aud).join(" ")
      : evidence.audience || evidence.aud
  );
  const verificationMethod = cleanString(
    evidence.verificationMethod || evidence.method
  );
  const verificationVersion = cleanString(
    evidence.verificationVersion || evidence.version
  );
  const sessionReference = cleanString(
    evidence.sessionReference || evidence.tokenReference || evidence.sessionId || evidence.jti
  );

  if (!subject) {
    fail("MOVIE_MENTOR_AUTH_SUBJECT_REQUIRED", "Verified authentication evidence requires a subject.");
  }
  if (!issuer) {
    fail("MOVIE_MENTOR_AUTH_ISSUER_REQUIRED", "Verified authentication evidence requires an issuer.");
  }
  if (!audience) {
    fail("MOVIE_MENTOR_AUTH_AUDIENCE_REQUIRED", "Verified authentication evidence requires an audience.");
  }
  if (!verificationMethod) {
    fail(
      "MOVIE_MENTOR_AUTH_VERIFICATION_METHOD_REQUIRED",
      "Verified authentication evidence requires a verification method."
    );
  }
  if (!verificationVersion) {
    fail(
      "MOVIE_MENTOR_AUTH_VERIFICATION_VERSION_REQUIRED",
      "Verified authentication evidence requires a verification version."
    );
  }

  const authenticatedAt = safeDate(evidence.authenticatedAt || evidence.authTime || evidence.iat);
  const expiresAt = safeDate(evidence.expiresAt || evidence.expiry || evidence.exp);
  const currentTime = safeDate(now);

  if (!authenticatedAt) {
    fail(
      "MOVIE_MENTOR_AUTH_TIME_REQUIRED",
      "Verified authentication evidence requires an authentication time."
    );
  }
  if (!expiresAt) {
    fail(
      "MOVIE_MENTOR_AUTH_EXPIRY_REQUIRED",
      "Verified authentication evidence requires an expiry time."
    );
  }
  if (!currentTime) {
    fail("MOVIE_MENTOR_AUTH_CLOCK_INVALID", "Authentication evaluation time is invalid.");
  }
  if (authenticatedAt.getTime() > currentTime.getTime()) {
    fail(
      "MOVIE_MENTOR_AUTH_TIME_IN_FUTURE",
      "Authentication evidence claims a future authentication time."
    );
  }
  if (expiresAt.getTime() <= currentTime.getTime()) {
    fail("MOVIE_MENTOR_AUTH_EXPIRED", "Authentication evidence is expired.");
  }

  if (evidence.revoked === true || evidence.active === false) {
    fail("MOVIE_MENTOR_AUTH_REVOKED", "Authentication evidence has been revoked or deactivated.");
  }

  return {
    subject,
    issuer,
    audience,
    verificationMethod,
    verificationVersion,
    sessionReference: sessionReference || null,
    authenticatedAt: authenticatedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

async function deriveMovieMentorPrincipal({
  request = null,
  verifyCredential = null,
  now = new Date(),
  expectedIssuer = null,
  expectedAudience = null,
} = {}) {
  if (typeof verifyCredential !== "function") {
    fail(
      "MOVIE_MENTOR_AUTH_VERIFIER_REQUIRED",
      "Movie Mentor authentication requires a deterministic credential verifier."
    );
  }

  const credential = readBearerCredential(request || {});

  let evidence;
  try {
    evidence = await verifyCredential({
      credential,
      expectedIssuer: cleanString(expectedIssuer) || null,
      expectedAudience: cleanString(expectedAudience) || null,
      now,
    });
  } catch (error) {
    fail(
      error?.code || "MOVIE_MENTOR_AUTH_VERIFICATION_FAILED",
      error instanceof Error ? error.message : "Authentication verifier failed."
    );
  }

  const verified = validateVerifiedEvidence(evidence, { now });
  const configuredIssuer = cleanString(expectedIssuer);
  const configuredAudience = cleanString(expectedAudience);

  if (configuredIssuer && verified.issuer !== configuredIssuer) {
    fail("MOVIE_MENTOR_AUTH_ISSUER_MISMATCH", "Verified authentication issuer does not match the configured issuer.");
  }
  if (configuredAudience) {
    const audiences = verified.audience.split(/\s+/).filter(Boolean);
    if (!audiences.includes(configuredAudience)) {
      fail(
        "MOVIE_MENTOR_AUTH_AUDIENCE_MISMATCH",
        "Verified authentication audience does not include the configured audience."
      );
    }
  }

  const principal = {
    authenticated: true,
    principalId: verified.subject,
    subject: verified.subject,
    issuer: verified.issuer,
    audience: verified.audience,
    sessionReference: verified.sessionReference,
    authenticatedAt: verified.authenticatedAt,
    expiresAt: verified.expiresAt,
    verificationMethod: verified.verificationMethod,
    verificationVersion: verified.verificationVersion,
    authenticationSource: "deterministic-credential-verifier",
  };

  return Object.freeze(principal);
}

export {
  MOVIE_MENTOR_DETERMINISTIC_PRINCIPAL_ADAPTER_VERSION,
  deriveMovieMentorPrincipal,
  readBearerCredential,
  validateVerifiedEvidence,
};

export default deriveMovieMentorPrincipal;
