import { deriveMovieMentorPrincipal } from "./MovieMentorDeterministicPrincipalAdapter.js";
import { createMovieMentorProjectOwnershipAuthority } from "./MovieMentorProjectOwnershipRegistry.js";

const MOVIE_MENTOR_CREATOR_REQUEST_AUTHORITY_VERSION = "1.1.0";
const MOVIE_MENTOR_CREATOR_REQUEST_AUTHORITY_DOMAIN = "iband.movie-mentor.creator-request-authority";
const MOVIE_MENTOR_PROJECT_OWNERSHIP_AUTHORITY_DOMAIN = "iband.movie-mentor.project-ownership-authority";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function ownedStatus(authority) {
  if (typeof authority?.getStatus !== "function") return null;
  try {
    const status = authority.getStatus();
    return status && typeof status === "object" && !Array.isArray(status) ? status : null;
  } catch {
    return null;
  }
}

function ownershipAuthorityCapabilityProven(status) {
  return status?.domain === MOVIE_MENTOR_PROJECT_OWNERSHIP_AUTHORITY_DOMAIN &&
    status?.configured === true &&
    status?.durable === true &&
    status?.authorization === "durable-owner-match" &&
    status?.createOnce === true &&
    status?.projectUnique === true &&
    status?.establishmentAuthorityUnique === true &&
    status?.legacyAdoption === "certified-attestation-only" &&
    status?.ownershipTransfer === false &&
    status?.processLocalFallback === false;
}

function createMovieMentorCreatorRequestAuthority({
  verifyCredential = null,
  expectedIssuer = null,
  expectedAudience = null,
  now = () => new Date(),
  derivePrincipal = deriveMovieMentorPrincipal,
  ownershipAuthority = createMovieMentorProjectOwnershipAuthority(),
} = {}) {
  if (typeof verifyCredential !== "function") {
    fail("MOVIE_MENTOR_CREATOR_AUTH_VERIFIER_REQUIRED", "Creator request authority requires a deterministic credential verifier.");
  }
  if (typeof derivePrincipal !== "function") {
    fail("MOVIE_MENTOR_CREATOR_PRINCIPAL_ADAPTER_REQUIRED", "Creator request authority requires a deterministic principal adapter.");
  }
  if (typeof ownershipAuthority?.authorizeProject !== "function") {
    fail("MOVIE_MENTOR_CREATOR_OWNERSHIP_AUTHORITY_REQUIRED", "Creator request authority requires project ownership authorization.");
  }

  async function authorize({ request = null, projectId = null } = {}) {
    const pid = text(projectId);
    if (!pid) {
      fail("MOVIE_MENTOR_CREATOR_PROJECT_REQUIRED", "Creator-facing Movie Mentor requests require an explicit projectId.");
    }

    const principal = await derivePrincipal({
      request,
      verifyCredential,
      expectedIssuer: text(expectedIssuer) || null,
      expectedAudience: text(expectedAudience) || null,
      now: now(),
    });

    const preflightStatus = ownedStatus(ownershipAuthority);
    if (preflightStatus && !ownershipAuthorityCapabilityProven(preflightStatus)) {
      fail("MOVIE_MENTOR_CREATOR_OWNERSHIP_CAPABILITY_NOT_PROVEN", "Creator request authority requires store-backed project ownership capability proof before ownership can authorize a creator request.");
    }

    const ownership = await ownershipAuthority.authorizeProject({ principal, projectId: pid });
    if (!ownership || ownership.authorized !== true) {
      fail("MOVIE_MENTOR_CREATOR_PROJECT_NOT_AUTHORIZED", "Authenticated principal is not authorized for this Movie Mentor project.");
    }

    const ownershipStatus = preflightStatus || ownedStatus(ownershipAuthority);
    if (!ownershipAuthorityCapabilityProven(ownershipStatus)) {
      fail("MOVIE_MENTOR_CREATOR_OWNERSHIP_CAPABILITY_NOT_PROVEN", "Project ownership may deny by method shape, but it may not grant creator authority without exact owner-proven durable capability.");
    }
    if (text(ownership.projectId) !== pid) {
      fail("MOVIE_MENTOR_CREATOR_PROJECT_AUTHORITY_CONFLICT", "Project ownership authority returned a different project identity.");
    }

    return Object.freeze({
      version: MOVIE_MENTOR_CREATOR_REQUEST_AUTHORITY_VERSION,
      domain: MOVIE_MENTOR_CREATOR_REQUEST_AUTHORITY_DOMAIN,
      authorized: true,
      principal,
      principalId: text(principal?.principalId),
      projectId: pid,
      ownershipRef: text(ownership.ownershipRef) || null,
      ownershipRevision: Number.isSafeInteger(ownership.ownershipRevision) ? ownership.ownershipRevision : null,
      authenticationSource: text(principal?.authenticationSource) || null,
      authorizationSource: text(ownership.authorizationSource) || "movie-mentor-project-ownership-registry",
    });
  }

  const status = Object.freeze({
    version: MOVIE_MENTOR_CREATOR_REQUEST_AUTHORITY_VERSION,
    domain: MOVIE_MENTOR_CREATOR_REQUEST_AUTHORITY_DOMAIN,
    ownershipCapabilityRequiredForGrant: true,
    methodShapeMayDenyOnly: true,
    processLocalFallback: false,
  });

  return Object.freeze({
    version: MOVIE_MENTOR_CREATOR_REQUEST_AUTHORITY_VERSION,
    domain: MOVIE_MENTOR_CREATOR_REQUEST_AUTHORITY_DOMAIN,
    authorize,
    getStatus: () => status,
  });
}

export {
  MOVIE_MENTOR_CREATOR_REQUEST_AUTHORITY_VERSION,
  MOVIE_MENTOR_CREATOR_REQUEST_AUTHORITY_DOMAIN,
  createMovieMentorCreatorRequestAuthority,
};

export default createMovieMentorCreatorRequestAuthority;
