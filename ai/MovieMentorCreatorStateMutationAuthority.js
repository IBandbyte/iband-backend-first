const MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_VERSION = "1.0.0";
const MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_DOMAIN = "iband.movie-mentor.creator-state-mutation-authority";
const MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_DOMAIN = "iband.movie-mentor.creator-state-mutation-proof";
const MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA = 1;

function s(value) { return typeof value === "string" ? value.trim() : ""; }
function n(value) { return Number.isSafeInteger(value) && value >= 0 ? value : null; }
function fail(code, message, extras = {}) { const error = new Error(message); error.code = code; error.retryable = false; Object.assign(error, extras); throw error; }

function normalizeMutationTarget({ projectId = null, source = null, expectedRevision = null, revision = null, creatorStateGeneration = null, creatorStateFingerprint = null } = {}) {
  const target = Object.freeze({
    projectId: s(projectId),
    source: s(source),
    expectedRevision: n(expectedRevision),
    revision: n(revision),
    creatorStateGeneration: n(creatorStateGeneration),
    creatorStateFingerprint: s(creatorStateFingerprint),
  });
  if (!target.projectId) fail("MOVIE_MENTOR_CREATOR_STATE_PROJECT_REQUIRED", "Durable creator-state mutation requires an exact projectId; session identity may locate history but may not authorize a new write.");
  if (!target.source) fail("MOVIE_MENTOR_CREATOR_STATE_MUTATION_SOURCE_REQUIRED", "Durable creator-state mutation requires an exact transition source.");
  if (target.expectedRevision === null || target.revision === null || target.revision !== target.expectedRevision + 1) fail("MOVIE_MENTOR_CREATOR_STATE_MUTATION_REVISION_INVALID", "Durable creator-state mutation authority must bind the exact expected and next revision.");
  if (target.creatorStateGeneration === null || target.creatorStateGeneration < 1 || !target.creatorStateFingerprint) fail("MOVIE_MENTOR_CREATOR_STATE_MUTATION_STATE_PROOF_REQUIRED", "Durable creator-state mutation authority must bind the exact next creator-state generation and fingerprint.");
  return target;
}

function createMovieMentorCreatorStateMutationAuthority({ request = null, authorization = null, requestAuthority = null } = {}) {
  if (typeof requestAuthority?.authorize !== "function") fail("MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_REQUIRED", "Creator-state mutation capability requires the production creator request authority.");
  const boundPrincipalId = s(authorization?.principalId);
  const boundProjectId = s(authorization?.projectId);
  if (authorization?.authorized !== true || !boundPrincipalId || !boundProjectId) fail("MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_REQUIRED", "Creator-state mutation capability requires an authenticated project authorization to bind before any mutation can be attempted.");
  const initialOwnershipRef = s(authorization?.ownershipRef) || null;
  const initialOwnershipRevision = n(authorization?.ownershipRevision);

  async function assertCurrentMutation(targetInput = {}) {
    const target = normalizeMutationTarget(targetInput);
    if (target.projectId !== boundProjectId) fail("MOVIE_MENTOR_CREATOR_STATE_MUTATION_BINDING_INVALID", "Creator-state mutation capability is bound to a different project.", { expectedProjectId: boundProjectId, actualProjectId: target.projectId });

    const current = await requestAuthority.authorize({ request, projectId: boundProjectId });
    const currentPrincipalId = s(current?.principalId);
    const currentProjectId = s(current?.projectId);
    const ownershipRef = s(current?.ownershipRef);
    const ownershipRevision = n(current?.ownershipRevision);
    if (current?.authorized !== true || currentPrincipalId !== boundPrincipalId || currentProjectId !== boundProjectId || !ownershipRef || ownershipRevision === null || ownershipRevision < 1) {
      fail("MOVIE_MENTOR_CREATOR_STATE_CURRENT_OWNERSHIP_REQUIRED", "Durable creator-state mutation requires fresh authenticated ownership of the exact project at the mutation boundary.", { projectId: boundProjectId, principalId: boundPrincipalId });
    }
    if (initialOwnershipRef && ownershipRef !== initialOwnershipRef) fail("MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_CHANGED", "Creator-state mutation authority changed ownership universe after request admission.", { initialOwnershipRef, currentOwnershipRef: ownershipRef });
    if (initialOwnershipRevision !== null && ownershipRevision !== initialOwnershipRevision) fail("MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_CHANGED", "Creator-state mutation authority changed ownership revision after request admission.", { initialOwnershipRevision, currentOwnershipRevision: ownershipRevision });

    return Object.freeze({
      version: MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_VERSION,
      domain: MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_DOMAIN,
      schema: MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA,
      authorized: true,
      currentOwnershipVerified: true,
      principalId: boundPrincipalId,
      projectId: boundProjectId,
      ownershipRef,
      ownershipRevision,
      authorizationSource: s(current?.authorizationSource) || null,
      source: target.source,
      expectedRevision: target.expectedRevision,
      revision: target.revision,
      creatorStateGeneration: target.creatorStateGeneration,
      creatorStateFingerprint: target.creatorStateFingerprint,
    });
  }

  return Object.freeze({
    version: MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_VERSION,
    domain: MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_DOMAIN,
    schema: MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA,
    principalId: boundPrincipalId,
    projectId: boundProjectId,
    assertCurrentMutation,
  });
}

async function assertMovieMentorCreatorStateMutationAuthority({ authority = null, projectId = null, source = null, expectedRevision = null, revision = null, creatorStateGeneration = null, creatorStateFingerprint = null } = {}) {
  const target = normalizeMutationTarget({ projectId, source, expectedRevision, revision, creatorStateGeneration, creatorStateFingerprint });
  if (authority?.domain !== MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_DOMAIN || authority?.schema !== MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA || typeof authority?.assertCurrentMutation !== "function" || !s(authority?.principalId) || s(authority?.projectId) !== target.projectId) {
    fail("MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_REQUIRED", "Durable creator-state mutation requires the exact server-created current-ownership capability.");
  }

  const proof = await authority.assertCurrentMutation(target);
  if (proof?.domain !== MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_DOMAIN || proof?.schema !== MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA || proof?.authorized !== true || proof?.currentOwnershipVerified !== true || s(proof?.principalId) !== s(authority.principalId) || s(proof?.projectId) !== target.projectId || !s(proof?.ownershipRef) || n(proof?.ownershipRevision) === null || proof.ownershipRevision < 1 || s(proof?.source) !== target.source || n(proof?.expectedRevision) !== target.expectedRevision || n(proof?.revision) !== target.revision || n(proof?.creatorStateGeneration) !== target.creatorStateGeneration || s(proof?.creatorStateFingerprint) !== target.creatorStateFingerprint) {
    fail("MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_INVALID", "Creator-state mutation capability did not prove the exact current ownership and state universe being mutated.");
  }
  return proof;
}

export {
  MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_VERSION,
  MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_DOMAIN,
  MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_DOMAIN,
  MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA,
  normalizeMutationTarget,
  createMovieMentorCreatorStateMutationAuthority,
  assertMovieMentorCreatorStateMutationAuthority,
};
export default createMovieMentorCreatorStateMutationAuthority;
