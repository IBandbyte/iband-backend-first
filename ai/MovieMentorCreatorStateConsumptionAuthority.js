const MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_AUTHORITY_VERSION = "1.0.0";
const MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_AUTHORITY_DOMAIN = "iband.movie-mentor.creator-state-consumption-authority";
const MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROOF_DOMAIN = "iband.movie-mentor.creator-state-consumption-proof";
const MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_SCHEMA = 1;
const CONSUMPTION_STAGES = new Set(["state-promotion", "provider-dispatch"]);

function s(value) { return typeof value === "string" ? value.trim() : ""; }
function n(value) { return Number.isSafeInteger(value) && value >= 0 ? value : null; }
function fail(code, message, extras = {}) { const error = new Error(message); error.code = code; error.retryable = false; Object.assign(error, extras); throw error; }

function normalizeConsumptionTarget({ projectId = null, stage = null, revision = null, creatorStateGeneration = null, creatorStateFingerprint = null, executionId = null, providerCallId = null } = {}) {
  const target = Object.freeze({
    projectId: s(projectId),
    stage: s(stage),
    revision: n(revision),
    creatorStateGeneration: n(creatorStateGeneration),
    creatorStateFingerprint: s(creatorStateFingerprint),
    executionId: s(executionId) || null,
    providerCallId: s(providerCallId) || null,
  });
  if (!target.projectId) fail("MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROJECT_REQUIRED", "Creator-state consumption requires an exact projectId; session identity may locate history but may not promote it into a live turn.");
  if (!CONSUMPTION_STAGES.has(target.stage)) fail("MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_STAGE_INVALID", "Creator-state consumption authority requires a recognized live consumption boundary.");
  if (target.revision === null || target.creatorStateGeneration === null || target.creatorStateGeneration < 1 || !target.creatorStateFingerprint) {
    fail("MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_STATE_PROOF_REQUIRED", "Creator-state consumption authority must bind the exact durable revision, creator-state generation and fingerprint being allowed to influence the live turn.");
  }
  if (target.stage === "provider-dispatch" && (!target.executionId || !target.providerCallId)) {
    fail("MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_DISPATCH_BINDING_REQUIRED", "Provider-dispatch consumption authority must bind the exact execution and provider-call universe.");
  }
  return target;
}

function createMovieMentorCreatorStateConsumptionAuthority({ request = null, authorization = null, requestAuthority = null } = {}) {
  if (typeof requestAuthority?.authorize !== "function") fail("MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_AUTHORITY_REQUIRED", "Creator-state consumption capability requires the production creator request authority.");
  const boundPrincipalId = s(authorization?.principalId);
  const boundProjectId = s(authorization?.projectId);
  if (authorization?.authorized !== true || !boundPrincipalId || !boundProjectId) {
    fail("MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_AUTHORITY_REQUIRED", "Creator-state consumption capability requires authenticated project authorization at request admission.");
  }
  const initialOwnershipRef = s(authorization?.ownershipRef) || null;
  const initialOwnershipRevision = n(authorization?.ownershipRevision);

  async function assertCurrentConsumption(targetInput = {}) {
    const target = normalizeConsumptionTarget(targetInput);
    if (target.projectId !== boundProjectId) {
      fail("MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_BINDING_INVALID", "Creator-state consumption capability is bound to a different project.", { expectedProjectId: boundProjectId, actualProjectId: target.projectId });
    }

    const current = await requestAuthority.authorize({ request, projectId: boundProjectId });
    const currentPrincipalId = s(current?.principalId);
    const currentProjectId = s(current?.projectId);
    const ownershipRef = s(current?.ownershipRef);
    const ownershipRevision = n(current?.ownershipRevision);
    if (current?.authorized !== true || currentPrincipalId !== boundPrincipalId || currentProjectId !== boundProjectId || !ownershipRef || ownershipRevision === null || ownershipRevision < 1) {
      fail("MOVIE_MENTOR_CREATOR_STATE_CURRENT_CONSUMPTION_OWNERSHIP_REQUIRED", "Live consumption of durable creator state requires fresh authenticated ownership of the exact project at the consumption boundary.", { projectId: boundProjectId, principalId: boundPrincipalId, stage: target.stage });
    }
    if (initialOwnershipRef && ownershipRef !== initialOwnershipRef) {
      fail("MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_OWNERSHIP_CHANGED", "Creator-state consumption authority changed ownership universe after request admission.", { initialOwnershipRef, currentOwnershipRef: ownershipRef, stage: target.stage });
    }
    if (initialOwnershipRevision !== null && ownershipRevision !== initialOwnershipRevision) {
      fail("MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_OWNERSHIP_CHANGED", "Creator-state consumption authority changed ownership revision after request admission.", { initialOwnershipRevision, currentOwnershipRevision: ownershipRevision, stage: target.stage });
    }

    return Object.freeze({
      version: MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_AUTHORITY_VERSION,
      domain: MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROOF_DOMAIN,
      schema: MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_SCHEMA,
      authorized: true,
      currentOwnershipVerified: true,
      principalId: boundPrincipalId,
      projectId: boundProjectId,
      ownershipRef,
      ownershipRevision,
      authorizationSource: s(current?.authorizationSource) || null,
      stage: target.stage,
      revision: target.revision,
      creatorStateGeneration: target.creatorStateGeneration,
      creatorStateFingerprint: target.creatorStateFingerprint,
      executionId: target.executionId,
      providerCallId: target.providerCallId,
    });
  }

  return Object.freeze({
    version: MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_AUTHORITY_VERSION,
    domain: MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_AUTHORITY_DOMAIN,
    schema: MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_SCHEMA,
    principalId: boundPrincipalId,
    projectId: boundProjectId,
    assertCurrentConsumption,
  });
}

async function assertMovieMentorCreatorStateConsumptionAuthority({ authority = null, projectId = null, stage = null, revision = null, creatorStateGeneration = null, creatorStateFingerprint = null, executionId = null, providerCallId = null } = {}) {
  const target = normalizeConsumptionTarget({ projectId, stage, revision, creatorStateGeneration, creatorStateFingerprint, executionId, providerCallId });
  if (authority?.domain !== MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_AUTHORITY_DOMAIN || authority?.schema !== MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_SCHEMA || typeof authority?.assertCurrentConsumption !== "function" || !s(authority?.principalId) || s(authority?.projectId) !== target.projectId) {
    fail("MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_AUTHORITY_REQUIRED", "Live creator-state consumption requires the exact server-created current-ownership capability.");
  }

  const proof = await authority.assertCurrentConsumption(target);
  if (
    proof?.domain !== MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROOF_DOMAIN
    || proof?.schema !== MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_SCHEMA
    || proof?.authorized !== true
    || proof?.currentOwnershipVerified !== true
    || s(proof?.principalId) !== s(authority.principalId)
    || s(proof?.projectId) !== target.projectId
    || !s(proof?.ownershipRef)
    || n(proof?.ownershipRevision) === null
    || proof.ownershipRevision < 1
    || s(proof?.stage) !== target.stage
    || n(proof?.revision) !== target.revision
    || n(proof?.creatorStateGeneration) !== target.creatorStateGeneration
    || s(proof?.creatorStateFingerprint) !== target.creatorStateFingerprint
    || (target.executionId !== (s(proof?.executionId) || null))
    || (target.providerCallId !== (s(proof?.providerCallId) || null))
  ) {
    fail("MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROOF_INVALID", "Creator-state consumption capability did not prove the exact current ownership and durable state universe being consumed.");
  }
  return proof;
}

export {
  MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_AUTHORITY_VERSION,
  MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_AUTHORITY_DOMAIN,
  MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROOF_DOMAIN,
  MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_SCHEMA,
  normalizeConsumptionTarget,
  createMovieMentorCreatorStateConsumptionAuthority,
  assertMovieMentorCreatorStateConsumptionAuthority,
};
export default createMovieMentorCreatorStateConsumptionAuthority;
