const MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_VERSION = "1.1.0";
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

function normalizeCreationTarget({ projectId = null, principalId = null, creatorTurnId = null, executionId = null, reservationId = null, requestDigest = null, ownerId = null, leaseGeneration = null, leaseReference = null, fencingToken = null } = {}) {
  const target = Object.freeze({
    projectId: s(projectId), principalId: s(principalId), creatorTurnId: s(creatorTurnId), executionId: s(executionId),
    reservationId: s(reservationId), requestDigest: s(requestDigest), ownerId: s(ownerId), leaseGeneration: n(leaseGeneration),
    leaseReference: s(leaseReference), fencingToken: s(fencingToken),
  });
  if (!target.projectId || !target.principalId || !target.creatorTurnId || !target.executionId || !target.reservationId || !target.requestDigest || !target.ownerId || target.leaseGeneration !== 1 || !target.leaseReference || !target.fencingToken) {
    fail("MOVIE_MENTOR_FORWARD_EXECUTION_CREATION_TARGET_REQUIRED", "Fresh execution creation requires the exact generation-one execution, reservation and lease universe before durable creation.");
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

  async function currentOwnership({ executionId = null, transition = null } = {}) {
    const current = await requestAuthority.authorize({ request, projectId });
    const currentOwnershipRef = s(current?.ownershipRef), currentOwnershipRevision = n(current?.ownershipRevision);
    if (current?.authorized !== true || s(current?.principalId) !== principalId || s(current?.projectId) !== projectId || !currentOwnershipRef || currentOwnershipRevision === null || currentOwnershipRevision < 1) {
      fail("MOVIE_MENTOR_FORWARD_EXECUTION_CURRENT_OWNERSHIP_REQUIRED", "Current creator/project ownership is required before durable forward execution authority may advance.", { projectId, principalId, executionId: s(executionId) || null, transition: s(transition) || null });
    }
    if (currentOwnershipRef !== initialOwnershipRef || currentOwnershipRevision !== initialOwnershipRevision) {
      fail("MOVIE_MENTOR_FORWARD_EXECUTION_OWNERSHIP_CHANGED", "Forward execution authority cannot cross into a different ownership universe.", { executionId: s(executionId) || null, transition: s(transition) || null });
    }
    return Object.freeze({ ownershipRef: currentOwnershipRef, ownershipRevision: currentOwnershipRevision });
  }

  async function assertCurrentReacquisition(targetInput = {}) {
    const target = normalizeReacquisitionTarget(targetInput);
    if (target.projectId !== projectId) fail("MOVIE_MENTOR_FORWARD_EXECUTION_BINDING_INVALID", "Forward execution capability is bound to a different project.");
    const current = await currentOwnership({ executionId: target.executionId, transition: "execution-reacquisition" });
    return Object.freeze({
      domain: MOVIE_MENTOR_FORWARD_EXECUTION_PROOF_DOMAIN, schema: MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_SCHEMA,
      authorized: true, currentOwnershipVerified: true, principalId, projectId,
      ownershipRef: current.ownershipRef, ownershipRevision: current.ownershipRevision,
      creatorTurnId: target.creatorTurnId, executionId: target.executionId,
      leaseGeneration: target.leaseGeneration, leaseReference: target.leaseReference, fencingToken: target.fencingToken,
      transition: "execution-reacquisition",
    });
  }

  async function assertCurrentCreation(targetInput = {}) {
    const target = normalizeCreationTarget(targetInput);
    if (target.projectId !== projectId || target.principalId !== principalId) fail("MOVIE_MENTOR_FORWARD_EXECUTION_BINDING_INVALID", "Fresh execution creation capability is bound to a different creator/project universe.");
    const current = await currentOwnership({ executionId: target.executionId, transition: "execution-creation" });
    return Object.freeze({
      domain: MOVIE_MENTOR_FORWARD_EXECUTION_PROOF_DOMAIN, schema: MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_SCHEMA,
      authorized: true, currentOwnershipVerified: true, principalId, projectId,
      ownershipRef: current.ownershipRef, ownershipRevision: current.ownershipRevision,
      creatorTurnId: target.creatorTurnId, executionId: target.executionId, reservationId: target.reservationId,
      requestDigest: target.requestDigest, ownerId: target.ownerId, leaseGeneration: 1,
      leaseReference: target.leaseReference, fencingToken: target.fencingToken,
      transition: "execution-creation",
    });
  }

  return Object.freeze({ version: MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_VERSION, domain: MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_DOMAIN, schema: MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_SCHEMA, principalId, projectId, assertCurrentReacquisition, assertCurrentCreation });
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

async function assertMovieMentorForwardExecutionCreationAuthority({ authority = null, ...targetInput } = {}) {
  const target = normalizeCreationTarget(targetInput);
  if (authority?.domain !== MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_DOMAIN || authority?.schema !== MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_SCHEMA || typeof authority?.assertCurrentCreation !== "function" || s(authority?.projectId) !== target.projectId || s(authority?.principalId) !== target.principalId) {
    fail("MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_REQUIRED", "Fresh execution creation requires the exact server-created forward execution capability.");
  }
  const proof = await authority.assertCurrentCreation(target);
  if (proof?.domain !== MOVIE_MENTOR_FORWARD_EXECUTION_PROOF_DOMAIN || proof?.schema !== MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_SCHEMA || proof?.authorized !== true || proof?.currentOwnershipVerified !== true || s(proof?.principalId) !== target.principalId || s(proof?.projectId) !== target.projectId || s(proof?.creatorTurnId) !== target.creatorTurnId || s(proof?.executionId) !== target.executionId || s(proof?.reservationId) !== target.reservationId || s(proof?.requestDigest) !== target.requestDigest || s(proof?.ownerId) !== target.ownerId || n(proof?.leaseGeneration) !== 1 || s(proof?.leaseReference) !== target.leaseReference || s(proof?.fencingToken) !== target.fencingToken || proof?.transition !== "execution-creation") {
    fail("MOVIE_MENTOR_FORWARD_EXECUTION_PROOF_INVALID", "Forward execution proof did not bind the exact generation-one execution universe being created.");
  }
  return proof;
}

export { MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_VERSION, MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_DOMAIN, MOVIE_MENTOR_FORWARD_EXECUTION_PROOF_DOMAIN, MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_SCHEMA, normalizeReacquisitionTarget, normalizeCreationTarget, createMovieMentorForwardExecutionAuthority, assertMovieMentorForwardExecutionReacquisitionAuthority, assertMovieMentorForwardExecutionCreationAuthority };
export default createMovieMentorForwardExecutionAuthority;
