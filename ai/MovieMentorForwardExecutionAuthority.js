const MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_VERSION = "1.0.0";
const MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_DOMAIN = "iband.movie-mentor.forward-execution-authority";
const MOVIE_MENTOR_FORWARD_EXECUTION_PROOF_DOMAIN = "iband.movie-mentor.forward-execution-proof";
const MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_SCHEMA = 1;

const s = (value) => (typeof value === "string" ? value.trim() : "");
const n = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);
function fail(code, message, extras = {}) { const error = new Error(message); error.code = code; error.retryable = false; Object.assign(error, extras); throw error; }

function normalizeReacquisitionTarget({ projectId = null, creatorTurnId = null, executionId = null, leaseGeneration = null, leaseReference = null, fencingToken = null } = {}) {
  const target = Object.freeze({
    projectId: s(projectId), creatorTurnId: s(creatorTurnId), executionId: s(executionId),
    leaseGeneration: n(leaseGeneration), leaseReference: s(leaseReference), fencingToken: s(fencingToken),
  });
  if (!target.projectId || !target.creatorTurnId || !target.executionId || target.leaseGeneration === null || !target.leaseReference || !target.fencingToken) {
    fail("MOVIE_MENTOR_FORWARD_EXECUTION_REACQUISITION_TARGET_REQUIRED", "Execution reacquisition requires the exact historical execution and lease universe before a successor lease may be minted.");
  }
  return target;
}

function createMovieMentorForwardExecutionAuthority({ request = null, authorization = null, requestAuthority = null } = {}) {
  if (typeof requestAuthority?.authorize !== "function") fail("MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_REQUIRED", "Forward execution capability requires production creator request authority.");
  const principalId = s(authorization?.principalId), projectId = s(authorization?.projectId);
  const initialOwnershipRef = s(authorization?.ownershipRef), initialOwnershipRevision = n(authorization?.ownershipRevision);
  if (authorization?.authorized !== true || !principalId || !projectId || !initialOwnershipRef || initialOwnershipRevision === null || initialOwnershipRevision < 1) {
    fail("MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_REQUIRED", "Forward execution capability requires authenticated current project ownership at request admission.");
  }

  async function assertCurrentReacquisition(targetInput = {}) {
    const target = normalizeReacquisitionTarget(targetInput);
    if (target.projectId !== projectId) fail("MOVIE_MENTOR_FORWARD_EXECUTION_BINDING_INVALID", "Forward execution capability is bound to a different project.");
    const current = await requestAuthority.authorize({ request, projectId });
    const currentOwnershipRef = s(current?.ownershipRef), currentOwnershipRevision = n(current?.ownershipRevision);
    if (current?.authorized !== true || s(current?.principalId) !== principalId || s(current?.projectId) !== projectId || !currentOwnershipRef || currentOwnershipRevision === null || currentOwnershipRevision < 1) {
      fail("MOVIE_MENTOR_FORWARD_EXECUTION_CURRENT_OWNERSHIP_REQUIRED", "Historical execution may be located, but current creator/project ownership is required before it may mint successor forward authority.", { projectId, principalId, executionId: target.executionId });
    }
    if (currentOwnershipRef !== initialOwnershipRef || currentOwnershipRevision !== initialOwnershipRevision) {
      fail("MOVIE_MENTOR_FORWARD_EXECUTION_OWNERSHIP_CHANGED", "Execution reacquisition cannot cross into a different ownership universe.", { executionId: target.executionId });
    }
    return Object.freeze({
      domain: MOVIE_MENTOR_FORWARD_EXECUTION_PROOF_DOMAIN, schema: MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_SCHEMA,
      authorized: true, currentOwnershipVerified: true, principalId, projectId,
      ownershipRef: currentOwnershipRef, ownershipRevision: currentOwnershipRevision,
      creatorTurnId: target.creatorTurnId, executionId: target.executionId,
      leaseGeneration: target.leaseGeneration, leaseReference: target.leaseReference, fencingToken: target.fencingToken,
      transition: "execution-reacquisition",
    });
  }
  return Object.freeze({ version: MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_VERSION, domain: MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_DOMAIN, schema: MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_SCHEMA, principalId, projectId, assertCurrentReacquisition });
}

async function assertMovieMentorForwardExecutionReacquisitionAuthority({ authority = null, ...targetInput } = {}) {
  const target = normalizeReacquisitionTarget(targetInput);
  if (authority?.domain !== MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_DOMAIN || authority?.schema !== MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_SCHEMA || typeof authority?.assertCurrentReacquisition !== "function" || s(authority?.projectId) !== target.projectId) {
    fail("MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_REQUIRED", "Execution reacquisition requires the exact server-created forward execution capability.");
  }
  const proof = await authority.assertCurrentReacquisition(target);
  if (proof?.domain !== MOVIE_MENTOR_FORWARD_EXECUTION_PROOF_DOMAIN || proof?.schema !== MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_SCHEMA || proof?.authorized !== true || proof?.currentOwnershipVerified !== true || s(proof?.principalId) !== s(authority.principalId) || s(proof?.projectId) !== target.projectId || s(proof?.creatorTurnId) !== target.creatorTurnId || s(proof?.executionId) !== target.executionId || n(proof?.leaseGeneration) !== target.leaseGeneration || s(proof?.leaseReference) !== target.leaseReference || s(proof?.fencingToken) !== target.fencingToken || proof?.transition !== "execution-reacquisition") {
    fail("MOVIE_MENTOR_FORWARD_EXECUTION_PROOF_INVALID", "Forward execution proof did not bind the exact historical execution universe being reacquired.");
  }
  return proof;
}

export { MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_VERSION, MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_DOMAIN, MOVIE_MENTOR_FORWARD_EXECUTION_PROOF_DOMAIN, MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_SCHEMA, normalizeReacquisitionTarget, createMovieMentorForwardExecutionAuthority, assertMovieMentorForwardExecutionReacquisitionAuthority };
export default createMovieMentorForwardExecutionAuthority;
