import { verifyToken as clerkVerifyToken } from "@clerk/backend";

const MOVIE_MENTOR_JOURNEY_RECOVERY_CLERK_CREDENTIAL_VERIFIER_VERSION = "1.0.0";
const MOVIE_MENTOR_JOURNEY_RECOVERY_CLERK_CREDENTIAL_VERIFIER_DOMAIN =
  "iband.movie-mentor.journey-recovery-clerk-credential-verifier";
const MOVIE_MENTOR_JOURNEY_RECOVERY_CLERK_VERIFICATION_METHOD =
  "clerk-session-jwt-rs256";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function fail(code, message, extras = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extras);
  throw error;
}

function isWildcardTrust(value) {
  const normalized = cleanString(value).toLowerCase();
  return normalized === "*" || normalized === "all" || normalized === "any" || normalized === "everyone";
}

function unixSecondsToIso(value, code, message) {
  if (!Number.isFinite(value)) {
    fail(code, message);
  }

  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) {
    fail(code, message);
  }

  return date.toISOString();
}

function decodeProtectedHeader(credential) {
  const token = cleanString(credential);
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    fail(
      "MOVIE_MENTOR_RECOVERY_CLERK_JWT_MALFORMED",
      "Journey recovery authentication requires a three-part Clerk JWT."
    );
  }

  let header;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    fail(
      "MOVIE_MENTOR_RECOVERY_CLERK_JWT_HEADER_INVALID",
      "Journey recovery authentication could not decode the Clerk JWT protected header."
    );
  }

  if (!header || typeof header !== "object" || Array.isArray(header)) {
    fail(
      "MOVIE_MENTOR_RECOVERY_CLERK_JWT_HEADER_INVALID",
      "Journey recovery authentication requires a valid Clerk JWT protected header."
    );
  }

  if (header.alg !== "RS256") {
    fail(
      "MOVIE_MENTOR_RECOVERY_CLERK_JWT_ALGORITHM_FORBIDDEN",
      "Journey recovery authentication accepts only Clerk RS256 session JWTs."
    );
  }

  if (header.typ !== "JWT") {
    fail(
      "MOVIE_MENTOR_RECOVERY_CLERK_JWT_TYPE_FORBIDDEN",
      "Journey recovery authentication accepts only JWT protected-header type JWT."
    );
  }

  return Object.freeze({
    alg: header.alg,
    typ: header.typ,
    kid: cleanString(header.kid) || null,
  });
}

function normalizeAuthorizedParties(authorizedParties) {
  if (!Array.isArray(authorizedParties) || authorizedParties.length === 0) {
    fail(
      "MOVIE_MENTOR_RECOVERY_CLERK_AUTHORIZED_PARTIES_REQUIRED",
      "Journey recovery Clerk verification requires explicit authorized parties."
    );
  }

  const normalized = [];
  for (const value of authorizedParties) {
    const party = cleanString(value);
    if (!party || isWildcardTrust(party)) {
      fail(
        "MOVIE_MENTOR_RECOVERY_CLERK_AUTHORIZED_PARTY_INVALID",
        "Journey recovery Clerk verification forbids blank or wildcard authorized parties."
      );
    }

    let parsed;
    try {
      parsed = new URL(party);
    } catch {
      fail(
        "MOVIE_MENTOR_RECOVERY_CLERK_AUTHORIZED_PARTY_INVALID",
        "Journey recovery Clerk authorized parties must be absolute HTTP(S) origins."
      );
    }

    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
      fail(
        "MOVIE_MENTOR_RECOVERY_CLERK_AUTHORIZED_PARTY_INVALID",
        "Journey recovery Clerk authorized parties must be absolute HTTP(S) origins without credentials, query, or fragment."
      );
    }

    const origin = parsed.origin;
    if (!normalized.includes(origin)) {
      normalized.push(origin);
    }
  }

  if (normalized.length === 0) {
    fail(
      "MOVIE_MENTOR_RECOVERY_CLERK_AUTHORIZED_PARTIES_REQUIRED",
      "Journey recovery Clerk verification requires explicit authorized parties."
    );
  }

  return Object.freeze(normalized);
}

function validatePublicKey(jwtKey) {
  const key = cleanString(jwtKey);
  if (!key) {
    fail(
      "MOVIE_MENTOR_RECOVERY_CLERK_JWT_KEY_REQUIRED",
      "Journey recovery Clerk verification requires an explicit JWT public key."
    );
  }

  if (/PRIVATE KEY/.test(key)) {
    fail(
      "MOVIE_MENTOR_RECOVERY_CLERK_PRIVATE_KEY_FORBIDDEN",
      "Journey recovery verification must never receive a Clerk private key."
    );
  }

  if (!/^-----BEGIN (?:RSA )?PUBLIC KEY-----[\s\S]+-----END (?:RSA )?PUBLIC KEY-----$/m.test(key)) {
    fail(
      "MOVIE_MENTOR_RECOVERY_CLERK_JWT_KEY_INVALID",
      "Journey recovery Clerk verification requires a PEM public key."
    );
  }

  return key;
}

function requireExplicitExpectation(value, code, label) {
  const normalized = cleanString(value);
  if (!normalized || isWildcardTrust(normalized)) {
    fail(code, `Journey recovery Clerk verification requires an explicit ${label}.`);
  }
  return normalized;
}

function normalizeAudience(value) {
  if (Array.isArray(value)) {
    return value.map(cleanString).filter(Boolean);
  }
  const audience = cleanString(value);
  return audience ? [audience] : [];
}

function createMovieMentorJourneyRecoveryClerkCredentialVerifier({
  jwtKey,
  authorizedParties,
  verifyTokenImpl = clerkVerifyToken,
} = {}) {
  const trustedJwtKey = validatePublicKey(jwtKey);
  const trustedAuthorizedParties = normalizeAuthorizedParties(authorizedParties);

  if (typeof verifyTokenImpl !== "function") {
    fail(
      "MOVIE_MENTOR_RECOVERY_CLERK_VERIFY_TOKEN_IMPLEMENTATION_REQUIRED",
      "Journey recovery Clerk verification requires the Clerk token verifier implementation."
    );
  }

  const verifyCredential = async ({
    credential,
    expectedIssuer,
    expectedAudience,
  } = {}) => {
    const token = cleanString(credential);
    if (!token) {
      fail(
        "MOVIE_MENTOR_RECOVERY_CLERK_CREDENTIAL_REQUIRED",
        "Journey recovery Clerk verification requires a credential."
      );
    }

    const issuer = requireExplicitExpectation(
      expectedIssuer,
      "MOVIE_MENTOR_RECOVERY_CLERK_EXPECTED_ISSUER_REQUIRED",
      "issuer"
    );
    const audience = requireExplicitExpectation(
      expectedAudience,
      "MOVIE_MENTOR_RECOVERY_CLERK_EXPECTED_AUDIENCE_REQUIRED",
      "audience"
    );

    decodeProtectedHeader(token);

    let claims;
    try {
      claims = await verifyTokenImpl(token, {
        jwtKey: trustedJwtKey,
        audience,
        authorizedParties: trustedAuthorizedParties,
        clockSkewInMs: 0,
        headerType: "JWT",
      });
    } catch (error) {
      fail(
        "MOVIE_MENTOR_RECOVERY_CLERK_TOKEN_VERIFICATION_FAILED",
        "Clerk rejected the journey recovery credential.",
        { cause: error }
      );
    }

    if (!claims || typeof claims !== "object" || Array.isArray(claims)) {
      fail(
        "MOVIE_MENTOR_RECOVERY_CLERK_VERIFIED_CLAIMS_INVALID",
        "Clerk verification did not return usable claims."
      );
    }

    const subject = cleanString(claims.sub);
    const actualIssuer = cleanString(claims.iss);
    const audiences = normalizeAudience(claims.aud);
    const sessionReference = cleanString(claims.sid || claims.jti);

    if (!subject) {
      fail(
        "MOVIE_MENTOR_RECOVERY_CLERK_SUBJECT_REQUIRED",
        "Verified Clerk journey recovery evidence requires a subject."
      );
    }
    if (actualIssuer !== issuer) {
      fail(
        "MOVIE_MENTOR_RECOVERY_CLERK_ISSUER_MISMATCH",
        "Verified Clerk issuer does not match the configured recovery issuer."
      );
    }
    if (!audiences.includes(audience)) {
      fail(
        "MOVIE_MENTOR_RECOVERY_CLERK_AUDIENCE_MISMATCH",
        "Verified Clerk audience does not include the configured recovery audience."
      );
    }
    if (!sessionReference) {
      fail(
        "MOVIE_MENTOR_RECOVERY_CLERK_SESSION_REFERENCE_REQUIRED",
        "Verified Clerk journey recovery evidence requires a session reference."
      );
    }

    return Object.freeze({
      verified: true,
      subject,
      issuer: actualIssuer,
      audience: Object.freeze([...audiences]),
      sessionReference,
      authenticatedAt: unixSecondsToIso(
        claims.iat,
        "MOVIE_MENTOR_RECOVERY_CLERK_ISSUED_AT_REQUIRED",
        "Verified Clerk journey recovery evidence requires a valid issued-at claim."
      ),
      expiresAt: unixSecondsToIso(
        claims.exp,
        "MOVIE_MENTOR_RECOVERY_CLERK_EXPIRY_REQUIRED",
        "Verified Clerk journey recovery evidence requires a valid expiry claim."
      ),
      verificationMethod: MOVIE_MENTOR_JOURNEY_RECOVERY_CLERK_VERIFICATION_METHOD,
      verificationVersion: MOVIE_MENTOR_JOURNEY_RECOVERY_CLERK_CREDENTIAL_VERIFIER_VERSION,
      active: true,
      revoked: false,
    });
  };

  return Object.freeze({
    version: MOVIE_MENTOR_JOURNEY_RECOVERY_CLERK_CREDENTIAL_VERIFIER_VERSION,
    domain: MOVIE_MENTOR_JOURNEY_RECOVERY_CLERK_CREDENTIAL_VERIFIER_DOMAIN,
    provider: "clerk",
    algorithm: "RS256",
    networkMode: "pinned-public-key",
    authorizedParties: trustedAuthorizedParties,
    verifyCredential,
  });
}

export {
  MOVIE_MENTOR_JOURNEY_RECOVERY_CLERK_CREDENTIAL_VERIFIER_VERSION,
  MOVIE_MENTOR_JOURNEY_RECOVERY_CLERK_CREDENTIAL_VERIFIER_DOMAIN,
  MOVIE_MENTOR_JOURNEY_RECOVERY_CLERK_VERIFICATION_METHOD,
  createMovieMentorJourneyRecoveryClerkCredentialVerifier,
  decodeProtectedHeader,
  normalizeAuthorizedParties,
};

export default createMovieMentorJourneyRecoveryClerkCredentialVerifier;
