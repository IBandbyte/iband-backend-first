import { deriveMovieMentorPrincipal } from "./MovieMentorDeterministicPrincipalAdapter.js";
import { authorizeMovieMentorJourneyRecoveryRequest } from "./MovieMentorJourneyRecoveryAuthorizationBoundary.js";
import { createMovieMentorProjectOwnershipAuthority } from "./MovieMentorProjectOwnershipRegistry.js";

const MOVIE_MENTOR_JOURNEY_RECOVERY_REQUEST_AUTHORITY_VERSION = "1.0.0";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function createMovieMentorJourneyRecoveryRequestAuthority({
  verifyCredential = null,
  expectedIssuer = null,
  expectedAudience = null,
  now = () => new Date(),
  derivePrincipal = deriveMovieMentorPrincipal,
  ownershipAuthority = createMovieMentorProjectOwnershipAuthority(),
  authorizeRecovery = authorizeMovieMentorJourneyRecoveryRequest,
} = {}) {
  if (typeof derivePrincipal !== "function") {
    fail("MOVIE_MENTOR_JOURNEY_RECOVERY_PRINCIPAL_ADAPTER_REQUIRED", "Journey recovery request authority requires a deterministic principal adapter.");
  }
  if (typeof ownershipAuthority?.authorizeProject !== "function") {
    fail("MOVIE_MENTOR_JOURNEY_RECOVERY_OWNERSHIP_AUTHORITY_REQUIRED", "Journey recovery request authority requires the project ownership authorization resolver.");
  }
  if (typeof authorizeRecovery !== "function") {
    fail("MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHORIZATION_BOUNDARY_REQUIRED", "Journey recovery request authority requires the recovery authorization boundary.");
  }

  async function authorize({ request = null, projectId = null } = {}) {
    const pid = cleanString(projectId);
    if (!pid) {
      fail("MOVIE_MENTOR_JOURNEY_RECOVERY_PROJECT_REQUIRED", "Journey recovery request authority requires an explicit server-selected projectId.");
    }

    // Identity is derived only from externally verified Bearer evidence. Request-body identity claims are deliberately irrelevant.
    const principal = await derivePrincipal({
      request,
      verifyCredential,
      expectedIssuer: cleanString(expectedIssuer) || null,
      expectedAudience: cleanString(expectedAudience) || null,
      now: now(),
    });

    const authorization = await authorizeRecovery({
      principal,
      projectId: pid,
      authorizeProject: ownershipAuthority.authorizeProject,
    });

    return Object.freeze({
      authorized: true,
      principal,
      principalId: authorization.principalId,
      projectId: authorization.projectId,
      ownershipRef: authorization.ownershipRef,
      authenticationSource: principal.authenticationSource,
      authorizationSource: authorization.authorizationSource,
    });
  }

  return Object.freeze({
    version: MOVIE_MENTOR_JOURNEY_RECOVERY_REQUEST_AUTHORITY_VERSION,
    authorize,
  });
}

export {
  MOVIE_MENTOR_JOURNEY_RECOVERY_REQUEST_AUTHORITY_VERSION,
  createMovieMentorJourneyRecoveryRequestAuthority,
};

export default createMovieMentorJourneyRecoveryRequestAuthority;
